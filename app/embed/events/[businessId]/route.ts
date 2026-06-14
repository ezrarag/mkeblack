import { NextRequest, NextResponse } from "next/server";
import { getPublicEventsForBusiness } from "@/lib/events-public";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET(
  request: NextRequest,
  { params }: { params: { businessId: string } }
) {
  const theme =
    request.nextUrl.searchParams.get("theme") === "dark" ? "dark" : "light";
  const events = await getPublicEventsForBusiness(
    params.businessId,
    request.nextUrl.origin
  );
  const dark = theme === "dark";
  const cards = events.length
    ? events
        .map(
          (event) => `
            <article class="card">
              ${event.photoUrl ? `<img src="${escapeHtml(event.photoUrl)}" alt="">` : ""}
              <div class="body">
                <p class="business">${escapeHtml(event.businessName)}</p>
                <h2>${escapeHtml(event.title)}</h2>
                <p class="date">${event.date ? new Date(event.date).toLocaleString() : "Date coming soon"}</p>
                <p>${escapeHtml(event.description)}</p>
                <a href="${escapeHtml(event.ticketUrl)}" target="_blank" rel="noreferrer">View event</a>
              </div>
            </article>
          `
        )
        .join("")
    : `<div class="empty">No upcoming events.</div>`;

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    :root { color-scheme: ${dark ? "dark" : "light"}; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: ${dark ? "#11100e" : "#fffaf2"};
      color: ${dark ? "#f8f2e9" : "#201b16"};
    }
    .wrap { padding: 16px; }
    .grid { display: grid; gap: 12px; }
    .card {
      overflow: hidden;
      border: 1px solid ${dark ? "#3b332b" : "#e6ded2"};
      border-radius: 12px;
      background: ${dark ? "#1b1815" : "#ffffff"};
    }
    img { width: 100%; height: 150px; object-fit: cover; display: block; }
    .body { padding: 14px; }
    .business {
      margin: 0 0 6px;
      color: #c68a2b;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: .14em;
      text-transform: uppercase;
    }
    h2 { margin: 0; font-size: 18px; line-height: 1.2; }
    p { color: ${dark ? "#c9beb2" : "#5f554b"}; font-size: 13px; line-height: 1.55; }
    .date { font-weight: 700; color: ${dark ? "#f8f2e9" : "#201b16"}; }
    a { color: #a76412; font-size: 13px; font-weight: 800; }
    .empty { padding: 28px; text-align: center; color: ${dark ? "#c9beb2" : "#5f554b"}; }
    .powered { margin-top: 12px; text-align: center; font-size: 11px; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="grid">${cards}</div>
    <div class="powered"><a href="${request.nextUrl.origin}/events" target="_blank" rel="noreferrer">Powered by MKE Black</a></div>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300"
    }
  });
}
