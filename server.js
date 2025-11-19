const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const axios = require('axios');
const youtubeSearch = require('youtube-search-api');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

app.use(express.static('public'));

// تخزين الغرف - كل غرفة لها قائمة انتظار خاصة
const rooms = new Map();
const users = new Map(); // تخزين معلومات المستخدمين

function createRoom(roomId, roomName, creatorName, isPrivate = false, password = null) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      id: roomId,
      name: roomName,
      creator: creatorName,
      creatorId: null,
      queue: [],
      currentPlaying: null,
      users: 0,
      usersList: [],
      history: [],
      settings: {
        repeat: false,
        shuffle: false,
        allowVoting: true,
        isPrivate: isPrivate,
        password: password
      },
      admins: [],
      moderators: [],
      bannedUsers: [],
      chatMessages: [],
      createdAt: new Date()
    });
  }
  return rooms.get(roomId);
}

function getRoomsList() {
  return Array.from(rooms.values()).map(room => ({
    id: room.id,
    name: room.name,
    creator: room.creator,
    users: room.users,
    queueLength: room.queue.length,
    isPlaying: !!room.currentPlaying,
    isPrivate: room.settings.isPrivate
  }));
}

io.on('connection', (socket) => {
  console.log(`مستخدم جديد متصل: ${socket.id}`);
  
  // إرسال قائمة الغرف المتاحة
  socket.emit('roomsList', getRoomsList());
  
  // تسجيل المستخدم
  socket.on('registerUser', (username) => {
    users.set(socket.id, {
      id: socket.id,
      username: username || `مستخدم${Math.floor(Math.random() * 1000)}`,
      joinedAt: new Date()
    });
    socket.emit('userRegistered', users.get(socket.id));
  });
  
  // إنشاء غرفة جديدة
  socket.on('createRoom', (data) => {
    const roomId = generateRoomId();
    const room = createRoom(roomId, data.roomName, data.creatorName, data.isPrivate, data.password);
    room.creatorId = socket.id;
    room.admins.push(socket.id);
    socket.emit('roomCreated', { roomId, roomName: room.name });
    io.emit('roomsList', getRoomsList());
    console.log(`غرفة جديدة: ${room.name} (${roomId})`);
  });
  
  // الانضمام لغرفة
  socket.on('joinRoom', (data) => {
    const roomId = typeof data === 'string' ? data : data.roomId;
    const password = typeof data === 'object' ? data.password : null;
    
    const room = rooms.get(roomId);
    if (!room) {
      socket.emit('error', 'الغرفة غير موجودة');
      return;
    }
    
    // التحقق من كلمة المرور للغرف الخاصة
    if (room.settings.isPrivate && room.settings.password !== password) {
      socket.emit('error', 'كلمة المرور غير صحيحة');
      socket.emit('requirePassword', roomId);
      return;
    }
    
    // التحقق من الحظر
    if (room.bannedUsers.includes(socket.id)) {
      socket.emit('error', 'تم حظرك من هذه الغرفة');
      return;
    }
    
    const user = users.get(socket.id);
    socket.join(roomId);
    socket.currentRoom = roomId;
    room.users++;
    room.usersList.push({
      id: socket.id,
      username: user?.username || 'مستخدم',
      role: room.admins.includes(socket.id) ? 'admin' : 
            room.moderators.includes(socket.id) ? 'moderator' : 'user'
    });
    
    socket.emit('roomJoined', {
      roomId,
      roomName: room.name,
      queue: room.queue,
      currentPlaying: room.currentPlaying,
      settings: room.settings,
      history: room.history,
      userRole: room.usersList.find(u => u.id === socket.id)?.role
    });
    
    io.to(roomId).emit('roomUsers', room.users);
    io.to(roomId).emit('usersList', room.usersList);
    io.to(roomId).emit('chatMessage', {
      type: 'system',
      message: `${user?.username || 'مستخدم'} انضم للغرفة`,
      timestamp: new Date()
    });
    io.emit('roomsList', getRoomsList());
    console.log(`${user?.username} انضم للغرفة: ${room.name}`);
  });
  
  // مغادرة الغرفة
  socket.on('leaveRoom', () => {
    if (socket.currentRoom) {
      const room = rooms.get(socket.currentRoom);
      if (room) {
        room.users--;
        socket.leave(socket.currentRoom);
        io.to(socket.currentRoom).emit('roomUsers', room.users);
        io.emit('roomsList', getRoomsList());
        
        // حذف الغرفة إذا أصبحت فارغة
        if (room.users === 0) {
          rooms.delete(socket.currentRoom);
          io.emit('roomsList', getRoomsList());
          console.log(`تم حذف الغرفة: ${room.name}`);
        }
      }
      socket.currentRoom = null;
    }
  });
  
  // البحث في يوتيوب
  socket.on('searchYoutube', async (query) => {
    try {
      const results = await youtubeSearch.GetListByKeyword(query, false, 5);
      const videos = results.items.map(item => ({
        id: item.id,
        title: item.title,
        channel: item.channelTitle,
        thumbnail: item.thumbnail.thumbnails[0].url,
        duration: item.length?.simpleText || 'N/A'
      }));
      socket.emit('searchResults', videos);
    } catch (error) {
      console.error('خطأ في البحث:', error.message);
      socket.emit('searchResults', []);
    }
  });
  
  // إضافة فيديو للقائمة
  socket.on('addToQueue', async (videoUrl) => {
    if (!socket.currentRoom) return;
    
    const room = rooms.get(socket.currentRoom);
    if (!room) return;
    
    const user = users.get(socket.id);
    const videoData = await getVideoData(videoUrl);
    if (videoData) {
      videoData.addedBy = user?.username || 'مستخدم';
      videoData.addedById = socket.id;
      videoData.votes = 0;
      videoData.voters = [];
      
      room.queue.push(videoData);
      io.to(socket.currentRoom).emit('queueUpdated', { queue: room.queue });
      io.to(socket.currentRoom).emit('chatMessage', {
        type: 'system',
        message: `${user?.username} أضاف: ${videoData.title}`,
        timestamp: new Date()
      });
      io.emit('roomsList', getRoomsList());
      
      if (!room.currentPlaying) {
        playNextInRoom(socket.currentRoom);
      }
    }
  });
  
  // التصويت على فيديو
  socket.on('voteVideo', (data) => {
    if (!socket.currentRoom) return;
    
    const room = rooms.get(socket.currentRoom);
    if (!room || !room.settings.allowVoting) return;
    
    const video = room.queue[data.index];
    if (!video) return;
    
    const voterIndex = video.voters.indexOf(socket.id);
    
    if (data.vote === 'up') {
      if (voterIndex === -1) {
        video.votes++;
        video.voters.push(socket.id);
      }
    } else if (data.vote === 'down') {
      if (voterIndex !== -1) {
        video.votes--;
        video.voters.splice(voterIndex, 1);
      }
    }
    
    // إعادة ترتيب حسب التصويت
    room.queue.sort((a, b) => b.votes - a.votes);
    io.to(socket.currentRoom).emit('queueUpdated', { queue: room.queue });
  });
  
  // إعادة ترتيب القائمة
  socket.on('reorderQueue', (data) => {
    if (!socket.currentRoom) return;
    
    const room = rooms.get(socket.currentRoom);
    if (!room) return;
    
    const [removed] = room.queue.splice(data.oldIndex, 1);
    room.queue.splice(data.newIndex, 0, removed);
    io.to(socket.currentRoom).emit('queueUpdated', { queue: room.queue });
  });
  
  // انتهى الفيديو
  socket.on('videoEnded', () => {
    if (socket.currentRoom) {
      playNextInRoom(socket.currentRoom);
    }
  });
  
  // تخطي الفيديو
  socket.on('skipVideo', () => {
    if (socket.currentRoom) {
      playNextInRoom(socket.currentRoom);
    }
  });
  
  // حذف من القائمة
  socket.on('removeFromQueue', (index) => {
    if (!socket.currentRoom) return;
    
    const room = rooms.get(socket.currentRoom);
    if (room && index >= 0 && index < room.queue.length) {
      room.queue.splice(index, 1);
      io.to(socket.currentRoom).emit('queueUpdated', { queue: room.queue });
      io.emit('roomsList', getRoomsList());
    }
  });
  
  // مسح القائمة
  socket.on('clearQueue', () => {
    if (!socket.currentRoom) return;
    
    const room = rooms.get(socket.currentRoom);
    if (room) {
      room.queue = [];
      io.to(socket.currentRoom).emit('queueUpdated', { queue: room.queue });
      io.emit('roomsList', getRoomsList());
    }
  });
  
  // تغيير إعدادات الغرفة
  socket.on('updateRoomSettings', (settings) => {
    if (!socket.currentRoom) return;
    
    const room = rooms.get(socket.currentRoom);
    if (!room || !room.admins.includes(socket.id)) return;
    
    room.settings = { ...room.settings, ...settings };
    io.to(socket.currentRoom).emit('roomSettingsUpdated', room.settings);
  });
  
  // إرسال رسالة دردشة
  socket.on('sendChatMessage', (message) => {
    if (!socket.currentRoom) return;
    
    const room = rooms.get(socket.currentRoom);
    const user = users.get(socket.id);
    if (!room || !user) return;
    
    const chatMessage = {
      type: 'user',
      username: user.username,
      userId: socket.id,
      message: message,
      timestamp: new Date()
    };
    
    room.chatMessages.push(chatMessage);
    if (room.chatMessages.length > 100) {
      room.chatMessages.shift();
    }
    
    io.to(socket.currentRoom).emit('chatMessage', chatMessage);
  });
  
  // ترقية/تخفيض رتبة مستخدم
  socket.on('changeUserRole', (data) => {
    if (!socket.currentRoom) return;
    
    const room = rooms.get(socket.currentRoom);
    if (!room || !room.admins.includes(socket.id)) return;
    
    const userIndex = room.usersList.findIndex(u => u.id === data.userId);
    if (userIndex === -1) return;
    
    if (data.role === 'moderator') {
      if (!room.moderators.includes(data.userId)) {
        room.moderators.push(data.userId);
      }
    } else if (data.role === 'user') {
      const modIndex = room.moderators.indexOf(data.userId);
      if (modIndex !== -1) {
        room.moderators.splice(modIndex, 1);
      }
    }
    
    room.usersList[userIndex].role = data.role;
    io.to(socket.currentRoom).emit('usersList', room.usersList);
  });
  
  // حظر مستخدم
  socket.on('banUser', (userId) => {
    if (!socket.currentRoom) return;
    
    const room = rooms.get(socket.currentRoom);
    if (!room || !room.admins.includes(socket.id)) return;
    
    if (!room.bannedUsers.includes(userId)) {
      room.bannedUsers.push(userId);
      
      // طرد المستخدم
      io.sockets.sockets.get(userId)?.emit('kicked', 'تم حظرك من الغرفة');
      io.sockets.sockets.get(userId)?.leave(socket.currentRoom);
    }
  });
  
  // حفظ قائمة تشغيل
  socket.on('savePlaylist', (playlistName) => {
    if (!socket.currentRoom) return;
    
    const room = rooms.get(socket.currentRoom);
    if (!room) return;
    
    const playlist = {
      name: playlistName,
      queue: room.queue,
      createdBy: users.get(socket.id)?.username,
      createdAt: new Date()
    };
    
    socket.emit('playlistSaved', playlist);
  });
  
  // حذف الغرفة (للمنشئ فقط)
  socket.on('deleteRoom', () => {
    if (!socket.currentRoom) return;
    
    const room = rooms.get(socket.currentRoom);
    if (!room || room.creatorId !== socket.id) {
      socket.emit('error', 'فقط منشئ الغرفة يمكنه حذفها');
      return;
    }
    
    // إخطار جميع الأعضاء
    io.to(socket.currentRoom).emit('roomDeleted', 'تم حذف الغرفة من قبل المنشئ');
    
    // حذف الغرفة
    rooms.delete(socket.currentRoom);
    io.emit('roomsList', getRoomsList());
    console.log(`تم حذف الغرفة: ${room.name} من قبل المنشئ`);
  });
  
  socket.on('disconnect', () => {
    if (socket.currentRoom) {
      const room = rooms.get(socket.currentRoom);
      const user = users.get(socket.id);
      
      if (room) {
        room.users--;
        
        // إزالة المستخدم من القائمة
        const userIndex = room.usersList.findIndex(u => u.id === socket.id);
        if (userIndex !== -1) {
          room.usersList.splice(userIndex, 1);
        }
        
        io.to(socket.currentRoom).emit('roomUsers', room.users);
        io.to(socket.currentRoom).emit('usersList', room.usersList);
        
        if (user) {
          io.to(socket.currentRoom).emit('chatMessage', {
            type: 'system',
            message: `${user.username} غادر الغرفة`,
            timestamp: new Date()
          });
        }
        
        io.emit('roomsList', getRoomsList());
        
        // لا نحذف الغرفة حتى لو أصبحت فارغة - تبقى محفوظة
        if (room.users === 0) {
          console.log(`الغرفة ${room.name} أصبحت فارغة لكنها محفوظة`);
        }
      }
    }
    
    users.delete(socket.id);
    console.log(`مستخدم غادر: ${socket.id}`);
  });
});

function playNextInRoom(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  
  // إضافة للتاريخ
  if (room.currentPlaying) {
    room.history.unshift(room.currentPlaying);
    if (room.history.length > 20) {
      room.history.pop();
    }
  }
  
  // وضع التكرار
  if (room.settings.repeat && room.currentPlaying) {
    io.to(roomId).emit('playVideo', room.currentPlaying);
    return;
  }
  
  if (room.queue.length > 0) {
    // وضع العشوائي
    if (room.settings.shuffle) {
      const randomIndex = Math.floor(Math.random() * room.queue.length);
      room.currentPlaying = room.queue.splice(randomIndex, 1)[0];
    } else {
      room.currentPlaying = room.queue.shift();
    }
    
    io.to(roomId).emit('playVideo', room.currentPlaying);
    io.to(roomId).emit('queueUpdated', { queue: room.queue });
    io.to(roomId).emit('historyUpdated', room.history);
    io.emit('roomsList', getRoomsList());
  } else {
    room.currentPlaying = null;
  }
}

function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

async function getVideoData(url) {
  const videoId = extractVideoId(url);
  if (!videoId) return null;
  
  try {
    const response = await axios.get(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
    
    return {
      id: videoId,
      title: response.data.title || 'فيديو يوتيوب',
      channel: response.data.author_name || 'قناة يوتيوب',
      thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
    };
  } catch (error) {
    console.error('خطأ في جلب بيانات الفيديو:', error.message);
    return {
      id: videoId,
      title: 'فيديو يوتيوب',
      channel: 'قناة يوتيوب',
      thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
    };
  }
}

function extractVideoId(url) {
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`🎵 الخادم يعمل على المنفذ ${PORT}`);
  console.log(`🌐 افتح المتصفح على: http://localhost:${PORT}`);
  console.log(`📡 جاهز للاتصالات من: ${HOST}:${PORT}`);
});
