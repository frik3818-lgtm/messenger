// Состояние приложения
let state = {
    currentUser: null,
    currentUserData: null,
    currentServer: null,
    currentChannel: 'general',
    servers: [],
    messages: [],
    users: [],
    onlineUsers: new Set()
};

// DOM элементы
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginTab = document.getElementById('login-tab');
const registerTab = document.getElementById('register-tab');

// Инициализация приложения
document.addEventListener('DOMContentLoaded', function() {
    initApp();
});

async function initApp() {
    // Проверяем состояние аутентификации
    firebaseApp.onAuthStateChanged(async (user) => {
        if (user) {
            // Пользователь вошел в систему
            state.currentUser = user;
            await loadUserData(user.uid);
            showApp();
        } else {
            // Пользователь не авторизован
            showAuth();
        }
    });
    
    // Настройка обработчиков событий
    setupEventListeners();
    
    // Настройка проверки формы регистрации
    setupRegistrationValidation();
}

// Настройка обработчиков событий
function setupEventListeners() {
    // Переключение между вкладками входа и регистрации
    loginTab.addEventListener('click', () => switchAuthTab('login'));
    registerTab.addEventListener('click', () => switchAuthTab('register'));
    
    // Обработка формы входа
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await login();
    });
    
    // Обработка формы регистрации
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await register();
    });
    
    // Забыли пароль
    document.getElementById('forgot-password').addEventListener('click', (e) => {
        e.preventDefault();
        forgotPassword();
    });
}

// Настройка валидации формы регистрации
function setupRegistrationValidation() {
    const usernameInput = document.getElementById('register-username');
    const emailInput = document.getElementById('register-email');
    const passwordInput = document.getElementById('register-password');
    const confirmInput = document.getElementById('register-confirm');
    const usernameCheck = document.getElementById('username-check');
    const emailCheck = document.getElementById('email-check');
    const usernameHint = document.getElementById('username-hint');
    const emailHint = document.getElementById('email-hint');
    const confirmHint = document.getElementById('confirm-hint');
    const strengthText = document.getElementById('password-strength-text');
    const strengthBar = document.querySelector('.strength-bar');
    const registerBtn = document.getElementById('register-btn');
    
    let usernameValid = false;
    let emailValid = false;
    let passwordValid = false;
    let confirmValid = false;
    
    // Проверка ника при вводе
    usernameInput.addEventListener('input', async () => {
        const username = usernameInput.value.trim();
        
        if (username.length < 3) {
            usernameCheck.className = 'check-icon';
            usernameHint.className = 'hint invalid';
            usernameHint.textContent = 'Минимум 3 символа';
            usernameValid = false;
            updateRegisterButton();
            return;
        }
        
        if (username.length > 20) {
            usernameCheck.className = 'check-icon taken';
            usernameHint.className = 'hint invalid';
            usernameHint.textContent = 'Максимум 20 символов';
            usernameValid = false;
            updateRegisterButton();
            return;
        }
        
        // Проверка допустимых символов
        const validChars = /^[a-zA-Z0-9_-]+$/;
        if (!validChars.test(username)) {
            usernameCheck.className = 'check-icon taken';
            usernameHint.className = 'hint invalid';
            usernameHint.textContent = 'Только буквы, цифры, _ и -';
            usernameValid = false;
            updateRegisterButton();
            return;
        }
        
        // Проверка доступности ника
        const result = await firebaseApp.checkUsernameAvailability(username);
        
        if (result.available) {
            usernameCheck.className = 'check-icon available';
            usernameHint.className = 'hint valid';
            usernameValid = true;
        } else {
            usernameCheck.className = 'check-icon taken';
            usernameHint.className = 'hint invalid';
            usernameValid = false;
        }
        
        usernameHint.textContent = result.message;
        updateRegisterButton();
    });
    
    // Проверка email при вводе
    emailInput.addEventListener('input', async () => {
        const email = emailInput.value.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        if (!emailRegex.test(email)) {
            emailCheck.className = 'check-icon';
            emailHint.className = 'hint invalid';
            emailHint.textContent = 'Неверный формат email';
            emailValid = false;
            updateRegisterButton();
            return;
        }
        
        // Проверка доступности email
        const result = await firebaseApp.checkEmailAvailability(email);
        
        if (result.available) {
            emailCheck.className = 'check-icon available';
            emailHint.className = 'hint valid';
            emailValid = true;
        } else {
            emailCheck.className = 'check-icon taken';
            emailHint.className = 'hint invalid';
            emailValid = false;
        }
        
        emailHint.textContent = result.message;
        updateRegisterButton();
    });
    
    // Проверка сложности пароля
    passwordInput.addEventListener('input', () => {
        const password = passwordInput.value;
        
        // Оценка сложности пароля
        let strength = 0;
        let message = 'Очень слабый';
        let color = '#ed4245';
        
        if (password.length >= 6) strength++;
        if (password.length >= 8) strength++;
        if (/[A-Z]/.test(password)) strength++;
        if (/[0-9]/.test(password)) strength++;
        if (/[^A-Za-z0-9]/.test(password)) strength++;
        
        switch(strength) {
            case 0:
            case 1:
                message = 'Очень слабый';
                color = '#ed4245';
                break;
            case 2:
                message = 'Слабый';
                color = '#faa81a';
                break;
            case 3:
                message = 'Средний';
                color = '#faa81a';
                break;
            case 4:
                message = 'Хороший';
                color = '#3ba55c';
                break;
            case 5:
                message = 'Отличный';
                color = '#3ba55c';
                break;
        }
        
        // Обновляем UI
        strengthBar.style.width = (strength * 20) + '%';
        strengthBar.style.backgroundColor = color;
        strengthText.textContent = message;
        strengthText.style.color = color;
        
        passwordValid = password.length >= 6;
        updateRegisterButton();
        
        // Проверка совпадения паролей
        if (confirmInput.value) {
            validatePasswordMatch();
        }
    });
    
    // Проверка совпадения паролей
    confirmInput.addEventListener('input', validatePasswordMatch);
    
    function validatePasswordMatch() {
        const password = passwordInput.value;
        const confirm = confirmInput.value;
        
        if (!confirm) {
            confirmHint.className = 'hint';
            confirmHint.textContent = '';
            confirmValid = false;
            updateRegisterButton();
            return;
        }
        
        if (password === confirm) {
            confirmHint.className = 'hint valid';
            confirmHint.textContent = 'Пароли совпадают';
            confirmValid = true;
        } else {
            confirmHint.className = 'hint invalid';
            confirmHint.textContent = 'Пароли не совпадают';
            confirmValid = false;
        }
        
        updateRegisterButton();
    }
    
    function updateRegisterButton() {
        registerBtn.disabled = !(usernameValid && emailValid && passwordValid && confirmValid);
    }
}

// Переключение между вкладками входа и регистрации
function switchAuthTab(tab) {
    loginTab.classList.remove('active');
    registerTab.classList.remove('active');
    loginForm.classList.remove('active');
    registerForm.classList.remove('active');
    
    if (tab === 'login') {
        loginTab.classList.add('active');
        loginForm.classList.add('active');
    } else {
        registerTab.classList.add('active');
        registerForm.classList.add('active');
    }
}

// Вход в систему
async function login() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    
    if (!username || !password) {
        showNotification('Заполните все поля', 'error');
        return;
    }
    
    const result = await firebaseApp.loginUser(username, password);
    
    if (result.success) {
        showNotification(result.message, 'success');
        // Приложение автоматически переключится через onAuthStateChanged
    } else {
        showNotification(result.error, 'error');
    }
}

async function register() {
    const username = document.getElementById('register-username').value.trim();
    const password = document.getElementById('register-password').value;
    
    if (!username || !password) {
        showNotification('Заполните все поля', 'error');
        return;
    }
    
    // Дополнительная валидация
    if (username.length < 3 || username.length > 20) {
        showNotification('Ник должен быть от 3 до 20 символов', 'error');
        return;
    }
    
    const validChars = /^[a-zA-Z0-9_-]+$/;
    if (!validChars.test(username)) {
        showNotification('Только буквы, цифры, _ и -', 'error');
        return;
    }
    
    if (password.length < 6) {
        showNotification('Пароль должен быть минимум 6 символов', 'error');
        return;
    }
    
    // Используем упрощенную регистрацию
    const result = await firebaseApp.registerUserSimple(username, password);
    
    if (result.success) {
        showNotification(result.message, 'success');
        // Очищаем форму регистрации
        document.getElementById('register-form').reset();
        // Переключаемся на вкладку входа
        switchAuthTab('login');
    } else {
        showNotification(result.error, 'error');
    }
}

// Вход (обновленная версия)
async function login() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    
    if (!username || !password) {
        showNotification('Заполните все поля', 'error');
        return;
    }
    
    // Используем упрощенный вход
    const result = await firebaseApp.loginUserSimple(username, password);
    
    if (result.success) {
        showNotification(result.message, 'success');
        // Приложение автоматически переключится через onAuthStateChanged
    } else {
        showNotification(result.error, 'error');
    }
}

// Обновление UI пользователя
function updateUserUI() {
    const usernameElement = document.getElementById('current-username');
    const avatarElement = document.getElementById('user-avatar');
    
    if (state.currentUserData) {
        usernameElement.textContent = state.currentUserData.displayName;
        avatarElement.textContent = state.currentUserData.displayName.charAt(0).toUpperCase();
        avatarElement.style.background = '#7289da';
    }
}

// Показать экран аутентификации
function showAuth() {
    authContainer.style.display = 'flex';
    appContainer.style.display = 'none';
    
    // Очищаем форму входа
    document.getElementById('login-form').reset();
    
    // Переключаемся на вкладку входа
    switchAuthTab('login');
}

// Показать основное приложение
function showApp() {
    authContainer.style.display = 'none';
    appContainer.style.display = 'flex';
    
    // Фокус на поле ввода сообщения
    setTimeout(() => {
        document.getElementById('message-input').focus();
    }, 100);
}

// Рендер серверов
function renderServers() {
    const serversList = document.getElementById('servers-list');
    serversList.innerHTML = '';
    
    state.servers.forEach(server => {
        const serverElement = document.createElement('div');
        serverElement.className = 'server-item';
        serverElement.innerHTML = `
            <div class="server-icon">
                ${server.icon ? `<img src="${server.icon}" alt="${server.name}" style="width: 100%; height: 100%; border-radius: inherit;">` : server.name.charAt(0)}
            </div>
            <div class="server-tooltip">${server.name}</div>
        `;
        
        serverElement.addEventListener('click', () => switchServer(server));
        serversList.appendChild(serverElement);
    });
}

// Переключение сервера
async function switchServer(server) {
    state.currentServer = server;
    document.getElementById('server-name').textContent = server.name;
    
    // Обновляем активный сервер в UI
    document.querySelectorAll('.server-item').forEach(item => {
        item.classList.remove('active');
    });
    
    event.currentTarget.classList.add('active');
    
    // Загружаем сообщения для общего канала
    await loadMessages('general');
}

// Загрузка сообщений
async function loadMessages(channelName) {
    state.currentChannel = channelName;
    document.getElementById('current-channel').textContent = channelName;
    
    // Загружаем сообщения
    state.messages = await firebaseApp.getMessages(channelName);
    renderMessages();
    
    // Настраиваем реальное время для этого канала
    setupRealtimeMessages(channelName);
}

// Рендер сообщений
function renderMessages() {
    const container = document.getElementById('messages-container');
    
    if (state.messages.length === 0) {
        container.innerHTML = `
            <div class="welcome-message">
                <h1>Добро пожаловать в #${state.currentChannel}!</h1>
                <p>Это начало канала. Отправьте сообщение, чтобы начать общение.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = '';
    
    state.messages.forEach(message => {
        const messageElement = createMessageElement(message);
        container.appendChild(messageElement);
    });
    
    // Прокручиваем вниз
    container.scrollTop = container.scrollHeight;
}

// Создание элемента сообщения
function createMessageElement(message) {
    const element = document.createElement('div');
    element.className = 'message';
    
    const time = message.timestamp ? 
        new Date(message.timestamp.seconds * 1000).toLocaleTimeString('ru-RU', { 
            hour: '2-digit', 
            minute: '2-digit' 
        }) : 'Только что';
    
    // Получаем имя пользователя
    const username = state.currentUserData?.displayName || 'Пользователь';
    const firstLetter = username.charAt(0).toUpperCase();
    
    element.innerHTML = `
        <div class="message-avatar">${firstLetter}</div>
        <div class="message-content">
            <div class="message-header">
                <span class="message-author">${username}</span>
                <span class="message-time">${time}</span>
            </div>
            <div class="message-text">${escapeHtml(message.content)}</div>
        </div>
    `;
    
    return element;
}

// Настройка реального времени для сообщений
function setupRealtimeMessages(channelName) {
    // Здесь можно добавить подписку на реальное время
    // Для простоты используем периодическую проверку
    setInterval(async () => {
        const newMessages = await firebaseApp.getMessages(channelName);
        if (newMessages.length !== state.messages.length) {
            state.messages = newMessages;
            renderMessages();
            
            // Воспроизводим звук для новых сообщений
            if (newMessages.length > state.messages.length) {
                playMessageSound();
            }
        }
    }, 3000);
}

// Отправка сообщения
async function sendMessage() {
    const input = document.getElementById('message-input');
    const content = input.value.trim();
    
    if (!content || !state.currentChannel || !state.currentUser) return;
    
    const result = await firebaseApp.sendMessage(
        state.currentChannel,
        state.currentUser.uid,
        content
    );
    
    if (result.success) {
        input.value = '';
        input.style.height = 'auto';
        
        // Добавляем сообщение локально для мгновенного отображения
        const newMessage = {
            content: content,
            userId: state.currentUser.uid,
            timestamp: { seconds: Date.now() / 1000 }
        };
        
        state.messages.push(newMessage);
        renderMessages();
        
    } else {
        showNotification('Ошибка отправки сообщения', 'error');
    }
}

// Обработка нажатия клавиш в поле ввода
function handleInputKeydown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
    
    // Автоматическое изменение высоты textarea
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
}

// Показать модальное окно создания сервера
function showCreateServerModal() {
    document.getElementById('server-title').value = '';
    document.getElementById('server-icon').value = '';
    document.getElementById('modal-overlay').style.display = 'flex';
    document.getElementById('create-server-modal').style.display = 'block';
}

// Создание сервера
async function createServer() {
    const name = document.getElementById('server-title').value.trim();
    
    if (!name) {
        showNotification('Введите название сервера', 'error');
        return;
    }
    
    const icon = document.getElementById('server-icon').value.trim() || null;
    
    const result = await firebaseApp.createServer(
        name,
        state.currentUser.uid,
        icon
    );
    
    if (result.success) {
        closeModal();
        showNotification('Сервер создан успешно!', 'success');
        
        // Обновляем список серверов
        state.servers = await firebaseApp.getUserServers(state.currentUser.uid);
        renderServers();
        
    } else {
        showNotification(result.error, 'error');
    }
}

// Закрыть модальное окно
function closeModal() {
    document.getElementById('modal-overlay').style.display = 'none';
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
}

// Показать профиль
function showProfileModal() {
    if (!state.currentUserData) return;
    
    document.getElementById('profile-username').value = state.currentUserData.displayName;
    document.getElementById('profile-email').value = state.currentUserData.email;
    document.getElementById('profile-status').value = state.currentUserData.status || 'online';
    
    document.getElementById('modal-overlay').style.display = 'flex';
    document.getElementById('profile-modal').style.display = 'block';
}

// Обновление профиля
async function updateProfile() {
    const status = document.getElementById('profile-status').value;
    
    try {
        await usersCollection.doc(state.currentUser.uid).update({
            status: status
        });
        
        state.currentUserData.status = status;
        closeModal();
        showNotification('Профиль обновлен', 'success');
        
    } catch (error) {
        showNotification('Ошибка обновления профиля', 'error');
    }
}

// Выход из системы
async function logout() {
    const result = await firebaseApp.logoutUser(state.currentUser.uid);
    
    if (result.success) {
        closeModal();
        showAuth();
        showNotification('Вы вышли из системы', 'info');
    } else {
        showNotification(result.error, 'error');
    }
}

// Показать уведомление
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
        <div class="notification-icon" style="background-color: ${type === 'success' ? '#3ba55c' : type === 'error' ? '#ed4245' : '#7289da'}">
            ${icons[type] || icons.info}
        </div>
        <div class="notification-content">
            <div class="notification-title">${type === 'success' ? 'Успешно' : type === 'error' ? 'Ошибка' : 'Уведомление'}</div>
            <div class="notification-message">${message}</div>
        </div>
        <button class="notification-close" onclick="this.parentElement.remove()">&times;</button>
    `;
    
    container.appendChild(notification);
    
    // Автоудаление через 5 секунд
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// Воспроизведение звука сообщения
function playMessageSound() {
    const audio = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-correct-answer-tone-2870.mp3');
    audio.volume = 0.3;
    audio.play().catch(() => {});
}

// Экранирование HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/\n/g, '<br>');
}

// Экспорт функций в глобальную область видимости
window.switchServer = switchServer;
window.showCreateServerModal = showCreateServerModal;
window.createServer = createServer;
window.closeModal = closeModal;
window.showProfileModal = showProfileModal;
window.updateProfile = updateProfile;
window.logout = logout;
window.toggleMute = () => showNotification('Функция микрофона', 'info');
window.toggleDeafen = () => showNotification('Функция наушников', 'info');
window.showSettings = () => showNotification('Настройки', 'info');
window.createTextChannel = () => showNotification('Создание текстового канала', 'info');
window.createVoiceChannel = () => showNotification('Создание голосового канала', 'info');
window.showInviteModal = () => showNotification('Приглашение участников', 'info');
window.showMembers = () => showNotification('Список участников', 'info');
window.showPinned = () => showNotification('Закрепленные сообщения', 'info');
window.searchMessages = () => showNotification('Поиск сообщений', 'info');
window.addEmoji = () => showNotification('Добавление эмодзи', 'info');
window.attachFile = () => showNotification('Прикрепление файла', 'info');
window.sendMessage = sendMessage;
window.handleInputKeydown = handleInputKeydown;
window.showTerms = () => showNotification('Условия использования', 'info');
