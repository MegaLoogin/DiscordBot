FROM node:20.9

WORKDIR /backend
COPY package.json .
RUN npm install
COPY . .
CMD npm start