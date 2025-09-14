FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force
COPY . .
USER 1000
EXPOSE $PORT
CMD ["npm", "start"]