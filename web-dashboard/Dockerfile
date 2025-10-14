FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .

ARG CONTROLLER_ORIGIN=http://localhost:8080
ENV VITE_CONTROLLER_ORIGIN=${CONTROLLER_ORIGIN}

RUN npm run build

FROM nginx:1.25-alpine

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
