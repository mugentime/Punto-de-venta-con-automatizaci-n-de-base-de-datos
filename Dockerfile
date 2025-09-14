FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production --no-audit
COPY . .
RUN adduser -D -s /bin/sh nodeuser
RUN chown -R nodeuser:nodeuser /app
USER nodeuser
EXPOSE 3000
CMD ["npm", "start"]