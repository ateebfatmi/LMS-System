export function POST() {
  return Response.json({ error: "Institute provisioning is available through platform administration." }, {
    status: 410,
    headers: { "cache-control": "no-store" },
  });
}
