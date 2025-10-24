FROM node:20-alpine
WORKDIR /app
# App-level install; no monorepo files needed
COPY package.json ./
RUN npm install
COPY . .
EXPOSE 5173
# Expose to host inside Docker
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
