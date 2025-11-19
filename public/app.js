const socket = io();

let player;
let isPlayerReady = false;
let isPlaying = false;
let currentVideoData = null;
let progressInterval = null;
let searchTimeout = null;
let isDraggingProgress = false;
let currentRoomId = null;
let availableRooms = [];

const tag = document.createElement('script');
tag.src = 'https://www.youtube.com/iframe_api';
const firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

function onYouTubeIframeAPIReady() {
  player = new YT.Player('player', {
    height: '0',
    width: '0',
    playerVars: {
      autoplay: 1,
      controls: 0
    },
    events: {
      onReady: onPlayerReady,
      onStateChange: onPlayerStateChange
    }
  });
}

function onPlayerReady() {
  isPlayerReady = true;
  player.setVolume(70);
  console.log('المشغل جاهز');
}

function onPlayerStateChange(event) {
  if (event.data === YT.PlayerState.ENDED) {
    socket.emit('videoEnded');
    stopProgressUpdate();
    isPlaying = false;
    updatePlayPauseButton();
  } else if (event.data === YT.PlayerState.PLAYING) {
    isPlaying = true;
    updatePlayPauseButton();
    startProgressUpdate();
    showEqualizer(true);
  } else if (event.data === YT.PlayerState.PAUSED) {
    isPlaying = false;
    updatePlayPauseButton();
    stopProgressUpdate();
    showEqualizer(false);
  }
}

// لا نعرض النافذة تلقائياً - سيتم عرضها من خلال roomsList

// تم نقل هذا الكود للأسفل لدمجه مع الانضمام التلقائي

// تم إنشاء غرفة جديدة
socket.on('roomCreated', (data) => {
  showNotification(`✅ تم إنشاء الغرفة: ${data.roomName}`, 'success');
  socket.emit('joinRoom', data.roomId);
});

// تم الانضمام للغرفة
socket.on('roomJoined', (data) => {
  currentRoomId = data.roomId;
  hideRoomModal();
  updateCurrentRoomInfo(data.roomName, data.roomId);
  updateQueue(data.queue);
  if (data.currentPlaying) {
    playVideo(data.currentPlaying);
  }
  showNotification(`🎵 انضممت للغرفة: ${data.roomName}`, 'success');
});

socket.on('queueUpdated', (data) => {
  updateQueue(data.queue);
});

socket.on('playVideo', (videoData) => {
  playVideo(videoData);
});

socket.on('roomUsers', (count) => {
  updateOnlineUsers(count);
});

socket.on('error', (message) => {
  showNotification(`❌ ${message}`, 'error');
});

function playVideo(videoData) {
  if (isPlayerReady) {
    currentVideoData = videoData;
    player.loadVideoById(videoData.id);
    updateVideoInfo(videoData);
    updateStatus('🎵 يتم التشغيل الآن...');
  } else {
    setTimeout(() => playVideo(videoData), 500);
  }
}

function updateVideoInfo(videoData) {
  const thumbnail = document.getElementById('thumbnail');
  const placeholder = document.getElementById('placeholderArt');
  const title = document.getElementById('videoTitle');
  const channel = document.getElementById('videoChannel');
  
  // إخفاء placeholder وإظهار الصورة
  if (placeholder) placeholder.style.display = 'none';
  
  thumbnail.src = videoData.thumbnail;
  thumbnail.style.display = 'block';
  title.textContent = videoData.title;
  channel.textContent = videoData.channel || 'قناة يوتيوب';
  
  // التأكد من تحميل الصورة
  thumbnail.onerror = () => {
    thumbnail.style.display = 'none';
    if (placeholder) placeholder.style.display = 'flex';
  };
  
  // تحديث Media Session للتشغيل في الخلفية
  updateMediaSession(videoData);
}

function updateQueue(queue) {
  const queueList = document.getElementById('queueList');
  const queueCount = document.getElementById('queueCount');
  const clearBtn = document.getElementById('clearQueueBtn');
  
  queueCount.textContent = queue.length;
  clearBtn.style.display = queue.length > 0 ? 'block' : 'none';
  
  if (queue.length === 0) {
    queueList.innerHTML = '<li class="empty-queue">📭 القائمة فارغة - أضف فيديو للبدء!</li>';
  } else {
    queueList.innerHTML = queue.map((video, index) => `
      <li data-index="${index}" onclick="playFromQueue(${index})" style="cursor: pointer;" title="اضغط للتشغيل">
        <img src="${video.thumbnail}" alt="${video.title}">
        <div class="queue-item-info">
          <div class="queue-item-title">${video.title}</div>
          <div class="queue-item-channel">${video.channel || 'قناة يوتيوب'}</div>
        </div>
        <button class="remove-btn" onclick="event.stopPropagation(); removeFromQueue(${index})">✕</button>
      </li>
    `).join('');
  }
}

// دالة جديدة لتشغيل أغنية من القائمة
function playFromQueue(index) {
  socket.emit('playFromQueue', index);
  showNotification('▶️ جاري التشغيل...', 'success');
}

window.playFromQueue = playFromQueue;

function updateOnlineUsers(count) {
  document.getElementById('onlineCount').textContent = count;
}

function updateStatus(text) {
  document.getElementById('status').textContent = text;
}

function showNotification(message, type = 'success') {
  const notification = document.getElementById('notification');
  notification.textContent = message;
  notification.className = `notification ${type} show`;
  
  setTimeout(() => {
    notification.classList.remove('show');
  }, 3000);
}

function showEqualizer(show) {
  const equalizer = document.getElementById('equalizerMini');
  if (equalizer) {
    equalizer.style.display = show ? 'flex' : 'none';
  }
}

function startProgressUpdate() {
  stopProgressUpdate();
  progressInterval = setInterval(updateProgress, 1000);
}

function stopProgressUpdate() {
  if (progressInterval) {
    clearInterval(progressInterval);
    progressInterval = null;
  }
}

function updateProgress() {
  if (!isPlayerReady || !player.getDuration) return;
  
  const currentTime = player.getCurrentTime();
  const duration = player.getDuration();
  
  if (duration > 0) {
    const progress = (currentTime / duration) * 100;
    const progressFill = document.getElementById('progressFill');
    if (progressFill) {
      progressFill.style.width = progress + '%';
    }
    document.getElementById('currentTime').textContent = formatTime(currentTime);
    document.getElementById('duration').textContent = formatTime(duration);
  }
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function updatePlayPauseButton() {
  const btn = document.getElementById('playPauseBtn');
  const playIcon = btn.querySelector('.play-icon');
  const pauseIcon = btn.querySelector('.pause-icon');
  
  if (isPlaying) {
    playIcon.style.display = 'none';
    pauseIcon.style.display = 'block';
  } else {
    playIcon.style.display = 'block';
    pauseIcon.style.display = 'none';
  }
}

// البحث التلقائي أثناء الكتابة
document.getElementById('videoUrl').addEventListener('input', (e) => {
  const query = e.target.value.trim();
  
  clearTimeout(searchTimeout);
  
  if (query.length > 2 && !isYoutubeUrl(query)) {
    searchTimeout = setTimeout(() => {
      socket.emit('searchYoutube', query);
    }, 500);
  } else {
    hideSearchResults();
  }
});

socket.on('searchResults', (videos) => {
  showSearchResults(videos);
});

function isYoutubeUrl(text) {
  return text.includes('youtube.com') || text.includes('youtu.be');
}

function showSearchResults(videos) {
  let resultsDiv = document.getElementById('searchResults');
  
  if (!resultsDiv) {
    resultsDiv = document.createElement('div');
    resultsDiv.id = 'searchResults';
    resultsDiv.className = 'search-results';
    document.querySelector('.search-container').appendChild(resultsDiv);
  }
  
  if (videos.length === 0) {
    resultsDiv.style.display = 'none';
    return;
  }
  
  resultsDiv.innerHTML = videos.map(video => `
    <div class="search-result-item" onclick="addVideoById('${video.id}', '${escapeHtml(video.title)}', '${escapeHtml(video.channel)}', '${video.thumbnail}')">
      <img src="${video.thumbnail}" alt="${video.title}">
      <div class="search-result-info">
        <div class="search-result-title">${video.title}</div>
        <div class="search-result-channel">${video.channel}</div>
      </div>
      <div class="search-result-duration">${video.duration}</div>
    </div>
  `).join('');
  
  resultsDiv.style.display = 'block';
}

function hideSearchResults() {
  const resultsDiv = document.getElementById('searchResults');
  if (resultsDiv) {
    resultsDiv.style.display = 'none';
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function addVideoById(id, title, channel, thumbnail) {
  const videoUrl = `https://www.youtube.com/watch?v=${id}`;
  socket.emit('addToQueue', videoUrl);
  document.getElementById('videoUrl').value = '';
  hideSearchResults();
  showNotification('✅ تمت الإضافة للقائمة بنجاح', 'success');
}

window.addVideoById = addVideoById;

document.getElementById('addBtn').addEventListener('click', () => {
  const input = document.getElementById('videoUrl');
  const url = input.value.trim();
  
  if (url) {
    if (isYoutubeUrl(url)) {
      socket.emit('addToQueue', url);
      input.value = '';
      hideSearchResults();
      showNotification('✅ تمت الإضافة للقائمة بنجاح', 'success');
    } else {
      showNotification('⚠️ الرجاء إدخال رابط يوتيوب صحيح', 'error');
    }
  } else {
    showNotification('⚠️ الرجاء إدخال رابط أو كلمة بحث', 'error');
  }
});

document.getElementById('videoUrl').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('addBtn').click();
  }
});

// إخفاء نتائج البحث عند النقر خارجها
document.addEventListener('click', (e) => {
  if (!e.target.closest('.search-container')) {
    hideSearchResults();
  }
});

document.getElementById('playPauseBtn').addEventListener('click', () => {
  if (!isPlayerReady) return;
  
  if (isPlaying) {
    player.pauseVideo();
  } else {
    player.playVideo();
  }
});

document.getElementById('nextBtn').addEventListener('click', () => {
  socket.emit('skipVideo');
});

document.getElementById('prevBtn').addEventListener('click', () => {
  if (isPlayerReady && player.seekTo) {
    player.seekTo(0);
  }
});

document.getElementById('muteBtn').addEventListener('click', () => {
  if (!isPlayerReady) return;
  
  const btn = document.getElementById('muteBtn');
  if (player.isMuted()) {
    player.unMute();
    btn.textContent = '🔊';
  } else {
    player.mute();
    btn.textContent = '🔇';
  }
});

document.getElementById('volumeSlider').addEventListener('input', (e) => {
  if (isPlayerReady) {
    player.setVolume(e.target.value);
    const btn = document.getElementById('muteBtn');
    btn.textContent = e.target.value > 0 ? '🔊' : '🔇';
  }
});

document.getElementById('clearQueueBtn').addEventListener('click', () => {
  if (confirm('هل تريد مسح جميع الفيديوهات من القائمة؟')) {
    socket.emit('clearQueue');
    showNotification('🗑️ تم مسح القائمة', 'success');
  }
});

// تحسين شريط التقدم - دعم النقر والسحب
const progressBar = document.querySelector('.progress-bar-modern');
if (progressBar) {
  // النقر على شريط التقدم
  progressBar.addEventListener('click', (e) => {
    if (!isPlayerReady || !player.getDuration) return;
    seekToPosition(e, progressBar);
  });
  
  // السحب على شريط التقدم
  progressBar.addEventListener('mousedown', (e) => {
    if (!isPlayerReady || !player.getDuration) return;
    isDraggingProgress = true;
    seekToPosition(e, progressBar);
  });
  
  document.addEventListener('mousemove', (e) => {
    if (isDraggingProgress && isPlayerReady) {
      seekToPosition(e, progressBar);
    }
  });
  
  document.addEventListener('mouseup', () => {
    isDraggingProgress = false;
  });
  
  // دعم اللمس للموبايل
  progressBar.addEventListener('touchstart', (e) => {
    if (!isPlayerReady || !player.getDuration) return;
    isDraggingProgress = true;
    const touch = e.touches[0];
    seekToPositionTouch(touch, progressBar);
  });
  
  progressBar.addEventListener('touchmove', (e) => {
    if (isDraggingProgress && isPlayerReady) {
      const touch = e.touches[0];
      seekToPositionTouch(touch, progressBar);
    }
  });
  
  progressBar.addEventListener('touchend', () => {
    isDraggingProgress = false;
  });
}

function seekToPosition(e, bar) {
  const rect = bar.getBoundingClientRect();
  // حساب من اليمين لأن الصفحة RTL
  const clickX = rect.right - e.clientX;
  const width = rect.width;
  const percentage = Math.max(0, Math.min(1, clickX / width));
  const duration = player.getDuration();
  player.seekTo(duration * percentage);
}

function seekToPositionTouch(touch, bar) {
  const rect = bar.getBoundingClientRect();
  // حساب من اليمين لأن الصفحة RTL
  const clickX = rect.right - touch.clientX;
  const width = rect.width;
  const percentage = Math.max(0, Math.min(1, clickX / width));
  const duration = player.getDuration();
  player.seekTo(duration * percentage);
}

function removeFromQueue(index) {
  socket.emit('removeFromQueue', index);
  showNotification('✅ تم الحذف من القائمة', 'success');
}

window.onYouTubeIframeAPIReady = onYouTubeIframeAPIReady;

// ===== وظائف الغرف =====

function showRoomModal() {
  document.getElementById('roomModal').classList.add('show');
}

function hideRoomModal() {
  document.getElementById('roomModal').classList.remove('show');
}

function updateCurrentRoomInfo(roomName, roomId) {
  document.getElementById('currentRoomName').textContent = roomName;
  document.getElementById('currentRoomId').textContent = `#${roomId}`;
  document.getElementById('currentRoomInfo').style.display = 'flex';
}

function updateRoomsList(rooms) {
  const roomsList = document.getElementById('roomsList');
  
  if (rooms.length === 0) {
    roomsList.innerHTML = '<div class="no-rooms">لا توجد غرف متاحة حالياً<br>أنشئ غرفة جديدة!</div>';
    return;
  }
  
  roomsList.innerHTML = rooms.map(room => `
    <div class="room-card ${room.isPrivate ? 'private' : ''}" onclick="joinRoom('${room.id}')">
      ${room.isPrivate ? '<span class="private-badge">🔒 خاصة</span>' : ''}
      <div class="room-card-header">
        <h3>${room.name}</h3>
        <span class="room-status ${room.isPlaying ? 'playing' : ''}">
          ${room.isPlaying ? '🎵 يتم التشغيل' : '⏸ متوقف'}
        </span>
      </div>
      <div class="room-card-info">
        <span>👤 ${room.users} متصل</span>
        <span>📝 ${room.queueLength} في القائمة</span>
        <span>👨‍💼 ${room.creator}</span>
      </div>
      <div class="room-card-id">#${room.id}</div>
    </div>
  `).join('');
}

function joinRoom(roomId) {
  // التأكد من تسجيل المستخدم قبل الانضمام
  if (!currentUsername) {
    const username = localStorage.getItem('username') || prompt('أدخل اسمك:');
    if (username) {
      registerUser(username);
    } else {
      showNotification('⚠️ يجب إدخال اسمك للانضمام', 'error');
      return;
    }
  }
  
  socket.emit('joinRoom', roomId);
}

// التبديل بين التبويبات
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    btn.classList.add('active');
    const tabId = btn.dataset.tab === 'join' ? 'joinTab' : 'createTab';
    document.getElementById(tabId).classList.add('active');
  });
});

// إنشاء غرفة جديدة
document.getElementById('createRoomBtn').addEventListener('click', () => {
  const roomName = document.getElementById('roomNameInput').value.trim();
  const creatorName = document.getElementById('creatorNameInput').value.trim();
  
  if (!roomName) {
    showNotification('⚠️ الرجاء إدخال اسم الغرفة', 'error');
    return;
  }
  
  if (!creatorName) {
    showNotification('⚠️ الرجاء إدخال اسمك', 'error');
    return;
  }
  
  socket.emit('createRoom', { roomName, creatorName });
});

// حذف الغرفة (للمنشئ فقط)
document.getElementById('deleteRoomBtn').addEventListener('click', () => {
  if (confirm('⚠️ هل أنت متأكد من حذف الغرفة نهائياً؟\nسيتم طرد جميع الأعضاء وحذف جميع البيانات!')) {
    socket.emit('deleteRoom');
  }
});

socket.on('roomDeleted', (message) => {
  alert(message);
  leaveCurrentRoom();
});

// مغادرة الغرفة
document.getElementById('leaveRoomBtn').addEventListener('click', () => {
  if (confirm('هل تريد مغادرة الغرفة؟')) {
    socket.emit('leaveRoom');
    leaveCurrentRoom();
  }
});

function leaveCurrentRoom() {
  currentRoomId = null;
  document.getElementById('currentRoomInfo').style.display = 'none';
  document.getElementById('deleteRoomBtn').style.display = 'none';
  
  // مسح معلومات الغرفة المحفوظة
  localStorage.removeItem('lastRoomId');
  localStorage.removeItem('lastRoomName');
  
  // تحديث URL
  window.history.pushState({}, '', '/');
  
  showRoomModal();
  
  // إيقاف التشغيل
  if (isPlayerReady && isPlaying) {
    player.stopVideo();
  }
  
  // مسح البيانات
  updateQueue([]);
  updateHistory([]);
  document.getElementById('chatMessages').innerHTML = '';
  document.getElementById('usersList').innerHTML = '';
  document.getElementById('videoTitle').textContent = 'اختر أغنيتك المفضلة';
  document.getElementById('videoChannel').textContent = 'وابدأ الاستماع الآن';
  
  const thumbnail = document.getElementById('thumbnail');
  const placeholder = document.getElementById('placeholderArt');
  thumbnail.style.display = 'none';
  if (placeholder) placeholder.style.display = 'flex';
}

window.joinRoom = joinRoom;


// ===== المتغيرات الجديدة =====
let currentUsername = '';
let userRole = 'user';
let roomSettings = { repeat: false, shuffle: false };
let playbackSpeed = 1;
const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
let currentSpeedIndex = 2;

// ===== تسجيل المستخدم =====
function registerUser(username) {
  currentUsername = username;
  socket.emit('registerUser', username);
  localStorage.setItem('username', username);
}

socket.on('userRegistered', (user) => {
  currentUsername = user.username;
});

// ===== التبويبات =====
document.querySelectorAll('.tab-header-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-header-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    
    btn.classList.add('active');
    const tabId = btn.dataset.tab + 'Tab';
    document.getElementById(tabId).classList.add('active');
  });
});

// ===== الدردشة =====
socket.on('chatMessage', (msg) => {
  addChatMessage(msg);
});

function addChatMessage(msg) {
  const chatMessages = document.getElementById('chatMessages');
  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message ${msg.type}`;
  
  if (msg.type === 'system') {
    messageDiv.innerHTML = `<span class="system-msg">${msg.message}</span>`;
  } else {
    messageDiv.innerHTML = `
      <div class="chat-user">${msg.username}</div>
      <div class="chat-text">${escapeHtml(msg.message)}</div>
      <div class="chat-time">${new Date(msg.timestamp).toLocaleTimeString('ar-EG', {hour: '2-digit', minute: '2-digit'})}</div>
    `;
  }
  
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

document.getElementById('sendChatBtn').addEventListener('click', () => {
  const input = document.getElementById('chatInput');
  const message = input.value.trim();
  
  if (message) {
    socket.emit('sendChatMessage', message);
    input.value = '';
  }
});

document.getElementById('chatInput').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('sendChatBtn').click();
  }
});

// ===== قائمة المستخدمين =====
socket.on('usersList', (users) => {
  updateUsersList(users);
});

function updateUsersList(users) {
  const usersList = document.getElementById('usersList');
  
  if (users.length === 0) {
    usersList.innerHTML = '<div class="no-users">لا يوجد مستخدمون</div>';
    return;
  }
  
  usersList.innerHTML = users.map(user => `
    <li class="user-item ${user.role}">
      <div class="user-avatar">${user.username.charAt(0).toUpperCase()}</div>
      <div class="user-details">
        <div class="user-name">${user.username}</div>
        <div class="user-role-badge">${getRoleName(user.role)}</div>
      </div>
      ${userRole === 'admin' && user.role !== 'admin' ? `
        <div class="user-actions">
          <button onclick="changeUserRole('${user.id}', 'moderator')" class="user-action-btn" title="ترقية">⬆️</button>
          <button onclick="banUser('${user.id}')" class="user-action-btn danger" title="حظر">🚫</button>
        </div>
      ` : ''}
    </li>
  `).join('');
}

function getRoleName(role) {
  const roles = { admin: 'مدير', moderator: 'مشرف', user: 'عضو' };
  return roles[role] || 'عضو';
}

window.changeUserRole = (userId, role) => {
  socket.emit('changeUserRole', { userId, role });
};

window.banUser = (userId) => {
  if (confirm('هل تريد حظر هذا المستخدم؟')) {
    socket.emit('banUser', userId);
  }
};

// ===== التاريخ =====
socket.on('historyUpdated', (history) => {
  updateHistory(history);
});

function updateHistory(history) {
  const historyList = document.getElementById('historyList');
  
  if (history.length === 0) {
    historyList.innerHTML = '<div class="no-history">لا يوجد تاريخ تشغيل</div>';
    return;
  }
  
  historyList.innerHTML = history.map((video, index) => `
    <li class="history-item">
      <img src="${video.thumbnail}" alt="${video.title}">
      <div class="history-info">
        <div class="history-title">${video.title}</div>
        <div class="history-channel">${video.channel}</div>
      </div>
      <button onclick="replayVideo('${video.id}')" class="replay-btn" title="إعادة التشغيل">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 5V1L7 6L12 11V7C15.31 7 18 9.69 18 13C18 16.31 15.31 19 12 19C8.69 19 6 16.31 6 13H4C4 17.42 7.58 21 12 21C16.42 21 20 17.42 20 13C20 8.58 16.42 5 12 5Z"/>
        </svg>
      </button>
    </li>
  `).join('');
}

window.replayVideo = (videoId) => {
  socket.emit('addToQueue', `https://www.youtube.com/watch?v=${videoId}`);
  showNotification('✅ تمت إضافة الأغنية للقائمة', 'success');
};

// ===== مشاركة الغرفة =====
document.getElementById('shareRoomBtn').addEventListener('click', () => {
  const roomUrl = `${window.location.origin}?room=${currentRoomId}`;
  
  if (navigator.share) {
    navigator.share({
      title: 'راديو يوتيوب',
      text: `انضم لغرفتي على راديو يوتيوب!`,
      url: roomUrl
    });
  } else {
    navigator.clipboard.writeText(roomUrl).then(() => {
      showNotification('✅ تم نسخ رابط الغرفة', 'success');
    });
  }
});

// ===== الانضمام عبر URL أو آخر غرفة =====
let autoJoinAttempted = false;

socket.on('roomsList', (rooms) => {
  availableRooms = rooms;
  updateRoomsList(rooms);
  
  // محاولة الانضمام التلقائي مرة واحدة فقط
  if (!autoJoinAttempted) {
    autoJoinAttempted = true;
    
    const urlParams = new URLSearchParams(window.location.search);
    let roomId = urlParams.get('room');
    
    // إذا لم يكن هناك room في URL، جرب آخر غرفة
    if (!roomId) {
      roomId = localStorage.getItem('lastRoomId');
    }
    
    if (roomId) {
      const room = availableRooms.find(r => r.id === roomId);
      if (room) {
        if (room.isPrivate) {
          const password = prompt('هذه غرفة خاصة. أدخل كلمة المرور:');
          if (password) {
            const username = localStorage.getItem('username') || prompt('أدخل اسمك:');
            if (username) {
              registerUser(username);
              socket.emit('joinRoom', { roomId, password });
            } else {
              showRoomModal();
            }
          } else {
            showRoomModal();
          }
        } else {
          const username = localStorage.getItem('username') || prompt('أدخل اسمك:');
          if (username) {
            registerUser(username);
            socket.emit('joinRoom', roomId);
          } else {
            showRoomModal();
          }
        }
      } else {
        showNotification('❌ الغرفة غير موجودة', 'error');
        localStorage.removeItem('lastRoomId');
        localStorage.removeItem('lastRoomName');
        showRoomModal();
      }
    } else {
      showRoomModal();
    }
  }
});

// ===== التكرار والعشوائي =====
document.getElementById('repeatBtn').addEventListener('click', () => {
  roomSettings.repeat = !roomSettings.repeat;
  document.getElementById('repeatBtn').classList.toggle('active', roomSettings.repeat);
  socket.emit('updateRoomSettings', { repeat: roomSettings.repeat });
  showNotification(roomSettings.repeat ? '🔁 تم تفعيل التكرار' : '🔁 تم إيقاف التكرار', 'success');
});

document.getElementById('shuffleBtn').addEventListener('click', () => {
  roomSettings.shuffle = !roomSettings.shuffle;
  document.getElementById('shuffleBtn').classList.toggle('active', roomSettings.shuffle);
  socket.emit('updateRoomSettings', { shuffle: roomSettings.shuffle });
  showNotification(roomSettings.shuffle ? '🔀 تم تفعيل العشوائي' : '🔀 تم إيقاف العشوائي', 'success');
});

socket.on('roomSettingsUpdated', (settings) => {
  roomSettings = settings;
  document.getElementById('repeatBtn').classList.toggle('active', settings.repeat);
  document.getElementById('shuffleBtn').classList.toggle('active', settings.shuffle);
});

// ===== سرعة التشغيل =====
document.getElementById('speedBtn').addEventListener('click', () => {
  currentSpeedIndex = (currentSpeedIndex + 1) % speeds.length;
  playbackSpeed = speeds[currentSpeedIndex];
  
  if (isPlayerReady && player.setPlaybackRate) {
    player.setPlaybackRate(playbackSpeed);
  }
  
  document.querySelector('.speed-text').textContent = `${playbackSpeed}x`;
  showNotification(`⚡ السرعة: ${playbackSpeed}x`, 'success');
});

// ===== الغرف الخاصة =====
document.getElementById('privateRoomCheck').addEventListener('change', (e) => {
  document.getElementById('passwordGroup').style.display = e.target.checked ? 'block' : 'none';
});

socket.on('requirePassword', (roomId) => {
  const password = prompt('هذه غرفة خاصة. أدخل كلمة المرور:');
  if (password) {
    socket.emit('joinRoom', { roomId, password });
  }
});

socket.on('kicked', (reason) => {
  alert(reason);
  socket.emit('leaveRoom');
  showRoomModal();
});

// ===== تحديث إنشاء الغرفة =====
const originalCreateRoomBtn = document.getElementById('createRoomBtn');
originalCreateRoomBtn.onclick = () => {
  const username = document.getElementById('usernameInput').value.trim();
  const roomName = document.getElementById('roomNameInput').value.trim();
  const isPrivate = document.getElementById('privateRoomCheck').checked;
  const password = isPrivate ? document.getElementById('roomPasswordInput').value.trim() : null;
  
  if (!username) {
    showNotification('⚠️ الرجاء إدخال اسمك', 'error');
    return;
  }
  
  if (!roomName) {
    showNotification('⚠️ الرجاء إدخال اسم الغرفة', 'error');
    return;
  }
  
  if (isPrivate && !password) {
    showNotification('⚠️ الرجاء إدخال كلمة مرور للغرفة الخاصة', 'error');
    return;
  }
  
  registerUser(username);
  socket.emit('createRoom', { roomName, creatorName: username, isPrivate, password });
};

// ===== تحديث قائمة الانتظار مع التصويت =====
socket.on('roomJoined', (data) => {
  currentRoomId = data.roomId;
  userRole = data.userRole || 'user';
  hideRoomModal();
  updateCurrentRoomInfo(data.roomName, data.roomId);
  updateQueue(data.queue);
  if (data.currentPlaying) {
    playVideo(data.currentPlaying);
  }
  if (data.settings) {
    roomSettings = data.settings;
    document.getElementById('repeatBtn').classList.toggle('active', data.settings.repeat);
    document.getElementById('shuffleBtn').classList.toggle('active', data.settings.shuffle);
  }
  if (data.history) {
    updateHistory(data.history);
  }
  
  // إظهار زر الحذف للمنشئ فقط
  if (userRole === 'admin') {
    document.getElementById('deleteRoomBtn').style.display = 'flex';
  } else {
    document.getElementById('deleteRoomBtn').style.display = 'none';
  }
  
  showNotification(`🎵 انضممت للغرفة: ${data.roomName}`, 'success');
  
  // حفظ معلومات الغرفة في localStorage
  localStorage.setItem('lastRoomId', data.roomId);
  localStorage.setItem('lastRoomName', data.roomName);
  
  // تحديث URL
  window.history.pushState({}, '', `?room=${data.roomId}`);
});

// تحديث دالة updateQueue لإضافة التصويت
updateQueue = function(queue) {
  const queueList = document.getElementById('queueList');
  const queueCount = document.getElementById('queueCount');
  const clearBtn = document.getElementById('clearQueueBtn');
  
  queueCount.textContent = queue.length;
  clearBtn.style.display = queue.length > 0 ? 'block' : 'none';
  
  if (queue.length === 0) {
    queueList.innerHTML = '<li class="empty-queue">📭 القائمة فارغة - أضف فيديو للبدء!</li>';
  } else {
    queueList.innerHTML = queue.map((video, index) => `
      <li data-index="${index}" draggable="true" class="queue-item-draggable">
        <div class="drag-handle">⋮⋮</div>
        <img src="${video.thumbnail}" alt="${video.title}">
        <div class="queue-item-info">
          <div class="queue-item-title">${video.title}</div>
          <div class="queue-item-channel">${video.channel}</div>
          <div class="queue-item-meta">
            <span>👤 ${video.addedBy || 'مستخدم'}</span>
            ${roomSettings.allowVoting ? `<span class="votes">👍 ${video.votes || 0}</span>` : ''}
          </div>
        </div>
        <div class="queue-item-actions">
          ${roomSettings.allowVoting ? `
            <button onclick="voteVideo(${index}, 'up')" class="vote-btn up" title="تصويت">👍</button>
          ` : ''}
          <button class="remove-btn" onclick="removeFromQueue(${index})">✕</button>
        </div>
      </li>
    `).join('');
    
    // إضافة Drag & Drop
    addDragAndDrop();
  }
};

// ===== التصويت =====
window.voteVideo = (index, vote) => {
  socket.emit('voteVideo', { index, vote });
};

// ===== Drag & Drop =====
function addDragAndDrop() {
  const items = document.querySelectorAll('.queue-item-draggable');
  let draggedItem = null;
  
  items.forEach((item, index) => {
    item.addEventListener('dragstart', () => {
      draggedItem = index;
      item.classList.add('dragging');
    });
    
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
    });
    
    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      const afterElement = getDragAfterElement(item.parentElement, e.clientY);
      if (afterElement == null) {
        item.parentElement.appendChild(item);
      } else {
        item.parentElement.insertBefore(item, afterElement);
      }
    });
    
    item.addEventListener('drop', (e) => {
      e.preventDefault();
      const newIndex = Array.from(items).indexOf(item);
      if (draggedItem !== newIndex) {
        socket.emit('reorderQueue', { oldIndex: draggedItem, newIndex });
      }
    });
  });
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.queue-item-draggable:not(.dragging)')];
  
  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}


// ===== PWA - تثبيت التطبيق =====
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  document.getElementById('installBtn').style.display = 'flex';
});

document.getElementById('installBtn').addEventListener('click', async () => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      showNotification('✅ تم تثبيت التطبيق بنجاح!', 'success');
    }
    
    deferredPrompt = null;
    document.getElementById('installBtn').style.display = 'none';
  }
});

window.addEventListener('appinstalled', () => {
  showNotification('🎉 تم تثبيت التطبيق!', 'success');
  document.getElementById('installBtn').style.display = 'none';
});

// تسجيل Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('Service Worker مسجل'))
      .catch(err => console.log('خطأ في Service Worker:', err));
  });
}


// ===== Media Session API - التشغيل في الخلفية =====
function updateMediaSession(videoData) {
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: videoData.title || 'راديو يوتيوب',
      artist: videoData.channel || 'قناة يوتيوب',
      album: 'راديو يوتيوب',
      artwork: [
        { src: videoData.thumbnail, sizes: '96x96', type: 'image/jpg' },
        { src: videoData.thumbnail, sizes: '128x128', type: 'image/jpg' },
        { src: videoData.thumbnail, sizes: '192x192', type: 'image/jpg' },
        { src: videoData.thumbnail, sizes: '256x256', type: 'image/jpg' },
        { src: videoData.thumbnail, sizes: '384x384', type: 'image/jpg' },
        { src: videoData.thumbnail, sizes: '512x512', type: 'image/jpg' }
      ]
    });

    // أزرار التحكم في الإشعارات
    navigator.mediaSession.setActionHandler('play', () => {
      if (isPlayerReady) {
        player.playVideo();
      }
    });

    navigator.mediaSession.setActionHandler('pause', () => {
      if (isPlayerReady) {
        player.pauseVideo();
      }
    });

    navigator.mediaSession.setActionHandler('previoustrack', () => {
      if (isPlayerReady && player.seekTo) {
        player.seekTo(0);
      }
    });

    navigator.mediaSession.setActionHandler('nexttrack', () => {
      socket.emit('skipVideo');
    });

    navigator.mediaSession.setActionHandler('seekbackward', (details) => {
      if (isPlayerReady && player.getCurrentTime) {
        const currentTime = player.getCurrentTime();
        player.seekTo(Math.max(0, currentTime - (details.seekOffset || 10)));
      }
    });

    navigator.mediaSession.setActionHandler('seekforward', (details) => {
      if (isPlayerReady && player.getCurrentTime && player.getDuration) {
        const currentTime = player.getCurrentTime();
        const duration = player.getDuration();
        player.seekTo(Math.min(duration, currentTime + (details.seekOffset || 10)));
      }
    });

    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (isPlayerReady && details.seekTime) {
        player.seekTo(details.seekTime);
      }
    });

    // تحديث حالة التشغيل
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }
}

// تحديث حالة Media Session عند تغيير حالة التشغيل
const originalOnPlayerStateChange = onPlayerStateChange;
onPlayerStateChange = function(event) {
  originalOnPlayerStateChange(event);
  
  if ('mediaSession' in navigator) {
    if (event.data === YT.PlayerState.PLAYING) {
      navigator.mediaSession.playbackState = 'playing';
    } else if (event.data === YT.PlayerState.PAUSED) {
      navigator.mediaSession.playbackState = 'paused';
    }
  }
};

// ===== Wake Lock API - منع قفل الشاشة أثناء التشغيل =====
let wakeLock = null;

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      console.log('Wake Lock مفعّل - الشاشة لن تُقفل');
      
      wakeLock.addEventListener('release', () => {
        console.log('Wake Lock تم إلغاؤه');
      });
    }
  } catch (err) {
    console.log('خطأ في Wake Lock:', err);
  }
}

async function releaseWakeLock() {
  if (wakeLock !== null) {
    try {
      await wakeLock.release();
      wakeLock = null;
      console.log('Wake Lock تم إلغاؤه يدوياً');
    } catch (err) {
      console.log('خطأ في إلغاء Wake Lock:', err);
    }
  }
}

// تفعيل Wake Lock عند بدء التشغيل
document.getElementById('playPauseBtn').addEventListener('click', () => {
  if (!isPlayerReady) return;
  
  if (isPlaying) {
    player.pauseVideo();
    releaseWakeLock();
  } else {
    player.playVideo();
    requestWakeLock();
  }
});

// إعادة تفعيل Wake Lock عند العودة للصفحة
document.addEventListener('visibilitychange', async () => {
  if (wakeLock !== null && document.visibilityState === 'visible') {
    await requestWakeLock();
  }
});

// ===== التشغيل في الخلفية - حل بسيط =====

// إعادة التشغيل عند العودة من الخلفية
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && isPlaying && isPlayerReady && player) {
    const state = player.getPlayerState();
    if (state !== YT.PlayerState.PLAYING) {
      player.playVideo();
    }
  }
});

// ===== Background Sync - مزامنة في الخلفية =====
if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
  navigator.serviceWorker.ready.then(registration => {
    // تسجيل Background Sync
    return registration.sync.register('sync-queue');
  }).catch(err => {
    console.log('Background Sync غير مدعوم:', err);
  });
}

// ===== Notification Permission - للإشعارات =====
async function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log('تم السماح بالإشعارات');
    }
  }
}

// طلب الإذن عند الانضمام لغرفة
socket.on('roomJoined', (data) => {
  currentRoomId = data.roomId;
  userRole = data.userRole || 'user';
  hideRoomModal();
  updateCurrentRoomInfo(data.roomName, data.roomId);
  updateQueue(data.queue);
  if (data.currentPlaying) {
    playVideo(data.currentPlaying);
  }
  if (data.settings) {
    roomSettings = data.settings;
    document.getElementById('repeatBtn').classList.toggle('active', data.settings.repeat);
    document.getElementById('shuffleBtn').classList.toggle('active', data.settings.shuffle);
  }
  if (data.history) {
    updateHistory(data.history);
  }
  
  // إظهار زر الحذف للمنشئ فقط
  if (userRole === 'admin') {
    document.getElementById('deleteRoomBtn').style.display = 'flex';
  } else {
    document.getElementById('deleteRoomBtn').style.display = 'none';
  }
  
  showNotification(`🎵 انضممت للغرفة: ${data.roomName}`, 'success');
  
  // طلب إذن الإشعارات
  requestNotificationPermission();
  
  // حفظ معلومات الغرفة في localStorage
  localStorage.setItem('lastRoomId', data.roomId);
  localStorage.setItem('lastRoomName', data.roomName);
  
  // تحديث URL
  window.history.pushState({}, '', `?room=${data.roomId}`);
});

// ===== إشعار عند إضافة أغنية جديدة =====
socket.on('chatMessage', (msg) => {
  addChatMessage(msg);
  
  // إشعار للأغاني الجديدة
  if (msg.type === 'system' && msg.message.includes('أضاف:') && 'Notification' in window && Notification.permission === 'granted') {
    new Notification('راديو يوتيوب', {
      body: msg.message,
      icon: '/manifest.json',
      badge: '/manifest.json',
      tag: 'new-song',
      requireInteraction: false
    });
  }
});

console.log('✅ تم تفعيل التشغيل في الخلفية وعند قفل الشاشة');
