// Состояние приложения
let state = {
    currentUser: null,
    currentServer: null,
    currentChannel: null,
    servers: [],
    channels: [],
    messages: [],
    users: [],
    onlineUsers: new Set()
};

// DOM элементы
const authModal = document.getElementById('auth-modal');
const mainApp = document.getElementById('main-app');
const messageInput = document.getElementById('message-input');
const messagesContainer = document.getElementById('messages-container');

// Инициализация приложения
document.addEventListener('DOMContentLoaded', async () => {
    // Проверяем аутентификацию
    firebaseApp.onAuthStateChanged(async (user) => {
        if (user) {
            state.currentUser = user;
            await loadUserData(user.uid);
            showMainApp();
            setupRealtimeListeners();
        } else {
            showAuthModal();
        }
    });
});

// Показать модальное окно аутентификации
function showAuthModal() {
    authModal.style.display = 'flex';
    mainApp.style.display = 'none';
}

function closeAuthModal() {
    authModal.style.display = 'none';
}

function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('login-form').style.display = tab === 'login' ? 'block' : 'none';
    document.getElementById('register-form').style.display = tab === 'register' ? 'block' : 'none';
    document.querySelector(`[onclick="switchTab('${tab}')"]`).classList.add('active');
}

// Аутентификация
async function login() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    if (!email || !password) {
        showNotification('Введите email и пароль', 'error');
        return;
    }
    
    const result = await firebaseApp.login(email, password);
    if (result.success) {
        showNotification('Вход выполнен успешно!', 'success');
        closeAuthModal();
    } else {
        showNotification(`Ошибка: ${result.error}`, 'error');
    }
}

async function register() {
    const username = document.getElementById('register-username').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const avatar = document.getElementById('register-avatar').value;
    
    if (!email || !password || !username) {
        showNotification('Заполните все обязательные поля', 'error');
        return;
    }
    
    if (password.length < 6) {
        showNotification('Пароль должен быть не менее 6 символов', 'error');
        return;
    }
    
    const result = await firebaseApp.register(email, password, username, avatar);
    if (result.success) {
        showNotification('Регистрация прошла успешно!', 'success');
        switchTab('login');
    } else {
        showNotification(`Ошибка: ${result.error}`, 'error');
    }
}

async function loginWithGoogle() {
    const result = await firebaseApp.loginWithGoogle();
    if (result.success) {
        showNotification('Вход через Google выполнен!', 'success');
        closeAuthModal();
    } else {
        showNotification(`Ошибка: ${result.error}`, 'error');
    }
}

async function loginWithGithub() {
    const result = await firebaseApp.loginWithGithub();
    if (result.success) {
        showNotification('Вход через GitHub выполнен!', 'success');
        closeAuthModal();
    } else {
        showNotification(`Ошибка: ${result.error}`, 'error');
    }
}

async function logout() {
    await firebaseApp.updateUserStatus(state.currentUser.uid, 'offline');
    const result = await firebaseApp.logout();
    if (result.success) {
        showNotification('Вы вышли из системы', 'info');
        showAuthModal();
    }
}

// Загрузка данных пользователя
async function loadUserData(userId) {
    try {
        // Загружаем серверы пользователя
        state.servers = await firebaseApp.getServers(userId);
        renderServers();
        
        // Если есть серверы, загружаем первый
        if (state.servers.length > 0) {
            await switchServer(state.servers[0].id);
        } else {
            // Создаем демо-сервер для нового пользователя
            const result = await firebaseApp.createServer(
                'Мой сервер',
                null,
                userId
            );
            
            if (result.success) {
                state.servers = await firebaseApp.getServers(userId);
                renderServers();
                await switchServer(state.servers[0].id);
            }
        }
        
        // Обновляем статус пользователя
        await firebaseApp.updateUserStatus(userId, 'online');
    } catch (error) {
        console.error('Error loading user data:', error);
        showNotification('Ошибка загрузки данных', 'error');
    }
}

// Показать основной интерфейс
function showMainApp() {
    authModal.style.display = 'none';
    mainApp.style.display = 'flex';
    renderCurrentUser();
}

// Рендер серверов
function renderServers() {
    const serversList = document.getElementById('servers-list');
    serversList.innerHTML = '';
    
    state.servers.forEach(server => {
        const serverElement = document.createElement('div');
        serverElement.className = `server-item ${state.currentServer?.id === server.id ? 'active' : ''}`;
        serverElement.innerHTML = server.icon 
            ? `<img src="${server.icon}" alt="${server.name}" style="width: 100%; height: 100%; border-radius: inherit;">`
            : `<span>${server.name.charAt(0)}</span>`;
        serverElement.title = server.name;
        serverElement.onclick = () => switchServer(server.id);
        serversList.appendChild(serverElement);
    });
}

// Рендер текущего пользователя
function renderCurrentUser() {
    const userInfo = document.getElementById('current-user-info');
    userInfo.innerHTML = `
        <div class="user-avatar" style="background-color: #5865f2;">
            <span>${state.currentUser?.email?.charAt(0).toUpperCase() || 'U'}</span>
        </div>
        <div class="user-details">
            <div class="user-name">${state.currentUser?.displayName || state.currentUser?.email?.split('@')[0] || 'Пользователь'}</div>
            <div class="user-status">Онлайн</div>
        </div>
    `;
}

// Переключение сервера
async function switchServer(serverId) {
    const server = state.servers.find(s => s.id === serverId);
    if (!server) return;
    
    state.currentServer = server;
    document.getElementById('server-name').textContent = server.name;
    
    // Загружаем каналы
    state.channels = await firebaseApp.getChannels(serverId);
    renderChannels();
    
    // Переключаемся на первый канал
    if (state.channels.length > 0) {
        await switchChannel(state.channels[0].id);
    }
    
    renderServers();
}

// Рендер каналов
function renderChannels() {
    const textChannelsList = document.getElementById('text-channels-list');
    const voiceChannelsList = document.getElementById('voice-channels-list');
    
    textChannelsList.innerHTML = '';
    voiceChannelsList.innerHTML = '';
    
    state.channels.forEach(channel => {
        const channelElement = document.createElement('div');
        channelElement.className = `channel-item ${state.currentChannel?.id === channel.id ? 'active' : ''}`;
        channelElement.innerHTML = `
            <i class="fas fa-${channel.type === 'voice' ? 'phone-alt' : 'hashtag'}"></i>
            <span>${channel.name}</span>
        `;
        channelElement.onclick = () => switchChannel(channel.id);
        
        if (channel.type === 'text') {
            textChannelsList.appendChild(channelElement);
        } else {
            voiceChannelsList.appendChild(channelElement);
        }
    });
}

// Переключение канала
async function switchChannel(channelId) {
    const channel = state.channels.find(c => c.id === channelId);
    if (!channel) return;
    
    state.currentChannel = channel;
    document.getElementById('current-channel-name').textContent = channel.name;
    
    // Очищаем старые слушатели
    if (state.unsubscribeMessages) {
        state.unsubscribeMessages();
    }
    
    // Загружаем сообщения
    state.messages = await firebaseApp.getMessages(channelId);
    renderMessages();
    
    // Подписываемся на новые сообщения в реальном времени
    state.unsubscribeMessages = firebaseApp.onMessages(channelId, (messages) => {
        state.messages = messages;
        renderMessages();
        
        // Воспроизводим звук для новых сообщений
        if (messages.length > state.messages.length) {
            playMessageSound();
            showNotification('Новое сообщение', 'info');
        }
    });
    
    renderChannels();
    messageInput.focus();
}

// Рендер сообщений
function renderMessages() {
    messagesContainer.innerHTML = '';
    
    if (state.messages.length === 0) {
        messagesContainer.innerHTML = `
            <div class="welcome-message">
                <h1>Добро пожаловать в #${state.currentChannel?.name || 'general'}!</h1>
                <p>Это начало канала. Начните общение, отправив сообщение ниже.</p>
            </div>
        `;
        return;
    }
    
    state.messages.forEach(message => {
        const messageElement = createMessageElement(message);
        messagesContainer.appendChild(messageElement);
    });
    
    // Прокручиваем вниз
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function createMessageElement(message) {
    const element = document.createElement('div');
    element.className = 'message';
    
    // Форматируем время
    const time = message.timestamp?.toDate 
        ? formatTime(message.timestamp.toDate())
        : 'Только что';
    
    element.innerHTML = `
        <div class="message-avatar">
            <span>${message.userId?.charAt(0).toUpperCase() || 'U'}</span>
        </div>
        <div class="message-content">
            <div class="message-header">
                <span class="message-author">${message.userId || 'Аноним'}</span>
                <span class="message-time">${time}</span>
            </div>
            <div class="message-text">${escapeHtml(message.content)}</div>
            ${message.attachments?.length > 0 ? renderAttachments(message.attachments) : ''}
            <div class="message-actions">
                <button class="message-action-btn" onclick="reactToMessage('${message.id}', '👍')">👍</button>
                <button class="message-action-btn" onclick="replyToMessage('${message.id}')">Ответить</button>
                ${message.userId === state.currentUser?.uid ? 
                    `<button class="message-action-btn" onclick="editMessage('${message.id}')">✏️</button>
                     <button class="message-action-btn" onclick="deleteMessage('${message.id}')">🗑️</button>` : ''}
            </div>
        </div>
    `;
    
    return element;
}

function renderAttachments(attachments) {
    return attachments.map(att => `
        <div class="attachment">
            <img src="${att.url}" alt="${att.name}" style="max-width: 200px; border-radius: 4px;">
        </div>
    `).join('');
}

// Отправка сообщения
async function sendMessage() {
    const content = messageInput.value.trim();
    if (!content || !state.currentChannel || !state.currentUser) return;
    
    const result = await firebaseApp.sendMessage(
        state.currentChannel.id,
        state.currentUser.uid,
        content
    );
    
    if (result.success) {
        messageInput.value = '';
        messageInput.style.height = 'auto';
    } else {
        showNotification(`Ошибка отправки: ${result.error}`, 'error');
    }
}

function handleMessageKeydown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
    
    // Авто-высота textarea
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
}

// Утилиты
function formatTime(date) {
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Только что';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} мин назад`;
    if (diff < 86400000) return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    return date.toLocaleDateString('ru-RU');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/\n/g, '<br>');
}

function showNotification(message, type = 'info') {
    const container = document.getElementById('notifications-container');
    const notification = document.createElement('div');
    notification.className = 'notification';
    
    const icons = {
        success: '✓',
        error: '✗',
        info: 'ℹ',
        warning: '⚠'
    };
    
    notification.innerHTML = `
        <div class="notification-icon" style="background-color: ${type === 'success' ? '#3ba55c' : type === 'error' ? '#ed4245' : '#5865f2'}">
            ${icons[type] || icons.info}
        </div>
        <div class="notification-content">
            <div class="notification-title">${type === 'success' ? 'Успешно' : type === 'error' ? 'Ошибка' : 'Уведомление'}</div>
            <div class="notification-message">${message}</div>
        </div>
        <button class="notification-close" onclick="this.parentElement.remove()">&times;</button>
    `;
    
    container.appendChild(notification);
    
    // Авто-удаление через 5 секунд
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

function playMessageSound() {
    const sound = document.getElementById('message-sound');
    sound.currentTime = 0;
    sound.play().catch(() => {});
}

// Настройка реального времени
function setupRealtimeListeners() {
    // Слушаем изменения статусов пользователей
    firebaseApp.onUsersPresence((users) => {
        state.users = users;
        state.onlineUsers = new Set(users.filter(u => u.status === 'online').map(u => u.id));
        updateOnlineCount();
        renderMembers();
    });
}

function updateOnlineCount() {
    const count = state.onlineUsers.size;
    document.getElementById('online-count').textContent = count;
    document.getElementById('sidebar-online-count').textContent = `${count} онлайн`;
}

function renderMembers() {
    const membersList = document.getElementById('members-list');
    if (!membersList) return;
    
    membersList.innerHTML = '';
    
    state.users.forEach(user => {
        const memberElement = document.createElement('div');
        memberElement.className = 'member-item';
        memberElement.innerHTML = `
            <div class="member-avatar">
                <span>${user.username?.charAt(0).toUpperCase() || 'U'}</span>
                <div class="member-status status-${user.status || 'offline'}"></div>
            </div>
            <div class="member-name">${user.username || 'Пользователь'}</div>
        `;
        membersList.appendChild(memberElement);
    });
}

// Создание сервера
function showAddServerModal() {
    document.getElementById('add-server-modal').style.display = 'flex';
}

function closeAddServerModal() {
    document.getElementById('add-server-modal').style.display = 'none';
}

async function createServer() {
    const name = document.getElementById('server-name-input').value.trim();
    const icon = document.getElementById('server-icon-input').value.trim();
    
    if (!name) {
        showNotification('Введите название сервера', 'error');
        return;
    }
    
    const result = await firebaseApp.createServer(
        name,
        icon || null,
        state.currentUser.uid
    );
    
    if (result.success) {
        showNotification(`Сервер "${name}" создан!`, 'success');
        closeAddServerModal();
        await loadUserData(state.currentUser.uid);
    } else {
        showNotification(`Ошибка: ${result.error}`, 'error');
    }
}

// Экспорт функций в глобальную область видимости
window.switchTab = switchTab;
window.closeAuthModal = closeAuthModal;
window.login = login;
window.register = register;
window.loginWithGoogle = loginWithGoogle;
window.loginWithGithub = loginWithGithub;
window.switchServer = switchServer;
window.switchChannel = switchChannel;
window.sendMessage = sendMessage;
window.handleMessageKeydown = handleMessageKeydown;
window.showAddServerModal = showAddServerModal;
window.closeAddServerModal = closeAddServerModal;
window.createServer = createServer;
window.addTextChannel = () => addChannel('text');
window.addVoiceChannel = () => addChannel('voice');

// Дополнительные функции
async function addChannel(type) {
    if (!state.currentServer) return;
    
    const name = prompt(`Введите название ${type === 'text' ? 'текстового' : 'голосового'} канала:`);
    if (!name) return;
    
    const result = await firebaseApp.createChannel(
        state.currentServer.id,
        name,
        type,
        state.currentUser.uid
    );
    
    if (result.success) {
        showNotification(`Канал "${name}" создан!`, 'success');
        state.channels = await firebaseApp.getChannels(state.currentServer.id);
        renderChannels();
    } else {
        showNotification(`Ошибка: ${result.error}`, 'error');
    }
}

// Обработка PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                console.log('ServiceWorker registration successful');
            })
            .catch(err => {
                console.log('ServiceWorker registration failed: ', err);
            });
    });
}
