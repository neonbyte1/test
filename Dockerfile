FROM denoland/deno

LABEL org.opencontainers.image.title="valkyrie-cheats: backend" \
      org.opencontainers.image.description="A minimal backend, fully managable via RESTful API" \
      org.opencontainers.image.authors="neonbyte1" \
      org.opencontainers.image.source="https://github.com/neonbyte1/test" \
      org.opencontainers.image.vendor="valkyrie-cheats" \
      org.opencontainers.image.licenses="PROPRIETARY"

WORKDIR /app

ADD . .

RUN deno cache src/main.ts drizzle.config.ts

EXPOSE 3000

CMD ["run", "-A", "src/main.ts"]
