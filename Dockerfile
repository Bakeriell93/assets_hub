FROM node:20-slim

# Install FFmpeg
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm install --production

# Copy the remux function
COPY api/remux-video.ts ./

# Install TypeScript and ts-node for runtime
RUN npm install -g typescript ts-node @types/node

EXPOSE 8080

CMD ["ts-node", "remux-video.ts"]
