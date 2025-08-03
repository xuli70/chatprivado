# Imagen base ligera
FROM node:18-alpine

# Metadatos
LABEL maintainer="xuli70"
LABEL description="Chat Anónimo Móvil - Aplicación web estática"
LABEL version="1.0.0"

# Configurar UTF-8 para caracteres especiales
ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8
ENV LANGUAGE=C.UTF-8

# Directorio de trabajo
WORKDIR /app

# Instalar Caddy (servidor web) y wget (para health checks)
RUN apk add --no-cache caddy wget

# Copiar solo archivos necesarios de la aplicación
COPY index.html .
COPY app.js .
COPY style.css .
COPY README.md .

# Configurar Caddy para servir en puerto 8080
RUN echo -e ":${PORT:-8080} {\n\
    root * /app\n\
    file_server\n\
    try_files {path} /index.html\n\
    encode gzip\n\
    \n\
    # Set proper charset for text files without overriding MIME types\n\
    header *.html Content-Type \"text/html; charset=utf-8\"\n\
    header *.css Content-Type \"text/css; charset=utf-8\"\n\
    header *.js Content-Type \"application/javascript; charset=utf-8\"\n\
    \n\
    # Cache control for better performance\n\
    header *.css Cache-Control \"public, max-age=31536000\"\n\
    header *.js Cache-Control \"public, max-age=31536000\"\n\
    header *.html Cache-Control \"public, max-age=3600\"\n\
    \n\
    log {\n\
        output stdout\n\
        format console\n\
    }\n\
}" > /app/Caddyfile

# Puerto 8080 (OBLIGATORIO para Coolify)
EXPOSE 8080

# Health check para que Coolify detecte si la app está funcionando
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1

# Comando de inicio
CMD ["caddy", "run", "--config", "/app/Caddyfile", "--adapter", "caddyfile"]