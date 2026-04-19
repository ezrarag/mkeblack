export function formatFirebaseError(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    switch (error.code) {
      case "auth/invalid-credential":
      case "auth/wrong-password":
      case "auth/user-not-found":
        return "The email or password was incorrect.";
      case "auth/invalid-email":
        return "Enter a valid email address.";
      case "auth/email-already-in-use":
        return "That email already has an account. Sign in instead or use another email address.";
      case "auth/account-exists-with-different-credential":
        return "That email already uses a different sign-in method. Try email and password instead.";
      case "auth/weak-password":
        return "Use a stronger password with at least 8 characters.";
      case "auth/popup-blocked":
        return "Your browser blocked the Google sign-in popup. Allow popups for this site and try again.";
      case "auth/popup-closed-by-user":
        return "The Google sign-in window was closed before sign-in finished.";
      case "auth/cancelled-popup-request":
        return "Another sign-in window is already open. Finish that one or close it before trying again.";
      case "auth/operation-not-allowed":
        return "This sign-in method is not enabled in Firebase Auth for this project.";
      case "auth/unauthorized-domain":
        return "This domain is not authorized for Firebase Auth. Add it to the project's authorized domains.";
      case "auth/too-many-requests":
        return "Too many attempts were made. Wait a few minutes and try again.";
      case "permission-denied":
        return "Firestore denied this write. Verify that this account is an admin in the active Firebase project and that the latest Firestore rules are deployed.";
      case "storage/unauthorized":
        return "You do not have permission to upload files for this listing.";
      default:
        return "Firebase returned an error. Check your configuration and try again.";
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}
