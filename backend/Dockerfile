FROM node:20.9

# Устанавливаем часовой пояс
ENV TZ=Europe/Kiev
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

WORKDIR /backend

# Создаем директорию volume и устанавливаем права
RUN mkdir -p /backend/volume && chmod 777 /backend/volume

COPY package*.json ./
RUN npm install

COPY . .

CMD ["npm", "start"]