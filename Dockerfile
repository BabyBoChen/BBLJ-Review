FROM denoland/deno:ubuntu-1.44.4
COPY . .
WORKDIR /app
EXPOSE 1993
CMD ["./run.sh"]
