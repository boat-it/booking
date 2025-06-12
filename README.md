# booking
จองห้องประชุม

docker stop meeting-room
docker rm meeting-room

docker build -t meeting-room-app .
docker run -d -p 3001:3000 --name meeting-room meeting-room-app