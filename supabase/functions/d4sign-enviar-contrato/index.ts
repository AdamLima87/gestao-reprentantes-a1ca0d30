Deno.serve(async (req) => {
  return new Response(JSON.stringify({ ok: true, msg: "funcao viva" }), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
});
