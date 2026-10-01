import net from 'node:net';

export const POST = async ({ request }) => {
  try {
    const body = await request.json();

    let host = body.host;
    let port = body.port;

    // Si viene la propiedad 'url', parseamos el host y el puerto
    if (body.url) {
      const parsedUrl = new URL(body.url);
      host = parsedUrl.hostname;
      
      // Usa el puerto de la URL o el puerto por defecto según el protocolo (http: 80, https: 443)
      port = parsedUrl.port 
        ? parseInt(parsedUrl.port, 10) 
        : (parsedUrl.protocol === 'https:' ? 443 : 80);
    }

    if (!host || !port) {
      return new Response(
        JSON.stringify({ active: false, error: 'Parametros host/port o url invalidos' }), 
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validamos la conexión TCP
    const active = await checkTcpPort(host, port, 3000);

    return new Response(
      JSON.stringify({ active }), 
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (e) {
    return new Response(
      JSON.stringify({ active: false, error: e.message }), 
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

function checkTcpPort(host, port, timeout = 3000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();

    // Configurar el tiempo límite de conexión
    socket.setTimeout(timeout);

    // Conexión exitosa
    socket.on('connect', () => {
      socket.destroy(); // Cerramos la conexión inmediatamente
      resolve(true);
    });

    // Error de conexión (puerto cerrado, rejeción, host inalcanzable, etc.)
    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });

    // Tiempo de espera agotado
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    // Intentar conectar al host y puerto
    socket.connect(port, host);
  });
}