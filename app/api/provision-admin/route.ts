import { NextRequest, NextResponse } from "next/server";
import { initializeApp, cert, getApps, getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";

function getAdminApp() {
  if (getApps().length) return getApp();

  const privateKey = process.env.NEXT_PUBLIC_FIREBASE_ADMIN_PRIVATE_KEY?.replace(
    /\\n/g,
    "\n"
  );

  return initializeApp({
    credential: cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
      clientEmail: process.env.NEXT_PUBLIC_FIREBASE_ADMIN_CLIENT_EMAIL!,
      privateKey: privateKey!
    })
  });
}

function getBearerToken(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
}

async function getVerifiedUser(req: NextRequest) {
  const token = getBearerToken(req);

  if (!token) {
    return null;
  }

  const app = getAdminApp();
  const auth = getAuth(app);
  const db = getFirestore(app);

  try {
    const decodedToken = await auth.verifyIdToken(token);
    return { auth, db, decodedToken };
  } catch {
    return null;
  }
}

async function getVerifiedAdmin(req: NextRequest) {
  const context = await getVerifiedUser(req);

  if (!context) {
    return null;
  }

  const userSnapshot = await context.db
    .collection("users")
    .doc(context.decodedToken.uid)
    .get();

  const hasAdminAccess =
    context.decodedToken.admin === true ||
    userSnapshot.data()?.role === "admin";

  return hasAdminAccess ? context : null;
}

function getNormalizedEmail(email: string) {
  return email.trim().toLowerCase();
}

function isUserNotFoundError(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  if ("code" in error && error.code === "auth/user-not-found") {
    return true;
  }

  if (
    "errorInfo" in error &&
    typeof error.errorInfo === "object" &&
    error.errorInfo !== null &&
    "code" in error.errorInfo &&
    error.errorInfo.code === "auth/user-not-found"
  ) {
    return true;
  }

  return false;
}

function getInvitePayload(
  email: string,
  name: string,
  decodedToken: DecodedIdToken
) {
  return {
    email,
    name,
    status: "pending",
    invitedAt: new Date().toISOString(),
    invitedByUid: decodedToken.uid,
    invitedByEmail: decodedToken.email ?? "",
    signInProvider: "google"
  };
}

export async function POST(req: NextRequest) {
  const context = await getVerifiedAdmin(req);

  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { email?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = body.email ? getNormalizedEmail(body.email) : "";
  const name = body.name?.trim() ?? "";

  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  try {
    const { auth, db, decodedToken } = context;
    const inviteRef = db.collection("admin_invites").doc(email);

    try {
      const existingUser = await auth.getUserByEmail(email);

      await db.collection("users").doc(existingUser.uid).set(
        {
          uid: existingUser.uid,
          email,
          name: name || existingUser.displayName || "",
          role: "admin",
          adminGrantedAt: new Date().toISOString(),
          adminGrantedByUid: decodedToken.uid,
          adminGrantedByEmail: decodedToken.email ?? ""
        },
        { merge: true }
      );

      await inviteRef.delete().catch(() => undefined);

      return NextResponse.json({
        success: true,
        uid: existingUser.uid,
        email,
        kind: "promoted-existing",
        message:
          "Existing account promoted to admin. They can sign in using the method already on their account."
      });
    } catch (error) {
      if (!isUserNotFoundError(error)) {
        throw error;
      }
    }

    const inviteSnapshot = await inviteRef.get();

    await inviteRef.set(getInvitePayload(email, name, decodedToken), {
      merge: true
    });

    return NextResponse.json({
      success: true,
      uid: null,
      email,
      kind: inviteSnapshot.exists ? "refreshed-invite" : "invited-google",
      message:
        "Google invite saved. They can sign in at /login with Continue with Google using this email."
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const context = await getVerifiedAdmin(req);

  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { db } = context;

    const [adminSnapshot, inviteSnapshot] = await Promise.all([
      db.collection("users").where("role", "==", "admin").get(),
      db.collection("admin_invites").where("status", "==", "pending").get()
    ]);

    const admins = adminSnapshot.docs
      .map((doc) => {
        const data = doc.data();
        return {
          uid: data.uid,
          email: data.email,
          name: data.name ?? "",
          provisionedAt: data.adminGrantedAt ?? data.provisionedAt ?? null
        };
      })
      .sort((left, right) => left.email.localeCompare(right.email));

    const invites = inviteSnapshot.docs
      .map((doc) => {
        const data = doc.data();
        return {
          email: data.email,
          name: data.name ?? "",
          invitedAt: data.invitedAt ?? null
        };
      })
      .sort((left, right) => left.email.localeCompare(right.email));

    return NextResponse.json({ admins, invites });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const context = await getVerifiedUser(req);

  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { db, decodedToken } = context;
    const email = decodedToken.email ? getNormalizedEmail(decodedToken.email) : "";

    if (!email) {
      return NextResponse.json(
        { error: "Signed-in user is missing an email address." },
        { status: 400 }
      );
    }

    const inviteRef = db.collection("admin_invites").doc(email);
    const inviteSnapshot = await inviteRef.get();

    if (!inviteSnapshot.exists) {
      return NextResponse.json({ promoted: false });
    }

    const inviteData = inviteSnapshot.data() ?? {};

    if (inviteData.status !== "pending") {
      return NextResponse.json({ promoted: false });
    }

    await db.collection("users").doc(decodedToken.uid).set(
      {
        uid: decodedToken.uid,
        email,
        name:
          (typeof inviteData.name === "string" && inviteData.name.trim()) ||
          decodedToken.name ||
          "",
        role: "admin",
        adminGrantedAt: new Date().toISOString(),
        adminGrantedByUid:
          typeof inviteData.invitedByUid === "string" ? inviteData.invitedByUid : "",
        adminGrantedByEmail:
          typeof inviteData.invitedByEmail === "string"
            ? inviteData.invitedByEmail
            : ""
      },
      { merge: true }
    );

    await inviteRef.set(
      {
        status: "accepted",
        acceptedAt: new Date().toISOString(),
        claimedByUid: decodedToken.uid
      },
      { merge: true }
    );

    return NextResponse.json({ promoted: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const context = await getVerifiedAdmin(req);

  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { uid?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const uid = body.uid?.trim();
  const email = body.email ? getNormalizedEmail(body.email) : "";

  if (!uid && !email) {
    return NextResponse.json(
      { error: "uid or email is required" },
      { status: 400 }
    );
  }

  try {
    const { db } = context;
    let inviteEmail = email;

    if (uid) {
      const userSnapshot = await db.collection("users").doc(uid).get();
      const userEmail = userSnapshot.data()?.email;

      await db.collection("users").doc(uid).set(
        { role: "business" },
        { merge: true }
      );

      if (!inviteEmail && typeof userEmail === "string" && userEmail.trim()) {
        inviteEmail = getNormalizedEmail(userEmail);
      }
    }

    if (inviteEmail) {
      await db.collection("admin_invites").doc(inviteEmail).delete();
    }

    return NextResponse.json({
      success: true,
      uid: uid ?? null,
      email: inviteEmail || null
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
