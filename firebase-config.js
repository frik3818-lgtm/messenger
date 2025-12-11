// Конфигурация Firebase (ЗАМЕНИТЕ НА СВОЮ!)
const firebaseConfig = {
    apiKey: "AIzaSyD7QtF9c4WgQOv2v_8K23_B9vY-5VK1V7M",
    authDomain: "anubis-messenger.firebaseapp.com",
    projectId: "anubis-messenger",
    storageBucket: "anubis-messenger.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef1234567890"
};

// Инициализация Firebase
firebase.initializeApp(firebaseConfig);

// Ссылки на сервисы
const auth = firebase.auth();
const db = firebase.firestore();

// Объект для работы с Firebase
const firebaseApp = {
    // Проверка доступности ника
    async checkUsernameAvailability(username) {
        try {
            const usersRef = db.collection('users');
            const snapshot = await usersRef
                .where('username', '==', username.toLowerCase())
                .limit(1)
                .get();
            
            return {
                available: snapshot.empty,
                message: snapshot.empty ? '✓ Ник свободен' : '✗ Ник уже занят'
            };
        } catch (error) {
            console.error('Error checking username:', error);
            return { available: false, message: 'Ошибка проверки' };
        }
    },

    // Упрощенная регистрация
    async registerUserSimple(username, password) {
        try {
            // Проверяем ник
            const usernameCheck = await this.checkUsernameAvailability(username);
            
            if (!usernameCheck.available) {
                return { success: false, error: 'Этот ник уже занят' };
            }
            
            // Создаем уникальный email для Firebase
            const uniqueEmail = `${username.toLowerCase().replace(/[^a-z0-9]/g, '')}_${Date.now()}@anubis.local`;
            
            console.log('Creating user with email:', uniqueEmail);
            
            // Создаем пользователя в Firebase Auth
            const userCredential = await auth.createUserWithEmailAndPassword(uniqueEmail, password);
            const user = userCredential.user;
            
            console.log('User created:', user.uid);
            
            // Сохраняем данные в Firestore
            const usersRef = db.collection('users');
            await usersRef.doc(user.uid).set({
                uid: user.uid,
                username: username.toLowerCase(),
                displayName: username,
                email: uniqueEmail,
                avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=7289da&color=fff`,
                status: 'online',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
                servers: []
            });
            
            console.log('User data saved to Firestore');
            
            // Создаем домашний сервер для пользователя
            await this.createHomeServer(user.uid, username);
            
            return { 
                success: true, 
                user: user,
                message: 'Регистрация прошла успешно!' 
            };
            
        } catch (error) {
            console.error('Registration error:', error.code, error.message);
            
            let errorMessage = 'Ошибка регистрации';
            
            switch(error.code) {
                case 'auth/email-already-in-use':
                    errorMessage = 'Попробуйте другой ник';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'Недопустимый ник';
                    break;
                case 'auth/operation-not-allowed':
                    errorMessage = 'Регистрация временно отключена';
                    break;
                case 'auth/weak-password':
                    errorMessage = 'Пароль слишком слабый (минимум 6 символов)';
                    break;
                case 'auth/network-request-failed':
                    errorMessage = 'Проблемы с интернет соединением';
                    break;
            }
            
            return { success: false, error: errorMessage };
        }
    },

    // Упрощенный вход
    async loginUserSimple(username, password) {
        try {
            console.log('Trying to login user:', username);
            
            // Находим пользователя по никнейму
            const usersRef = db.collection('users');
            const snapshot = await usersRef
                .where('username', '==', username.toLowerCase())
                .limit(1)
                .get();
            
            if (snapshot.empty) {
                console.log('User not found in Firestore');
                return { success: false, error: 'Пользователь не найден' };
            }
            
            const userDoc = snapshot.docs[0];
            const userData = userDoc.data();
            const email = userData.email;
            
            console.log('Found user email:', email);
            
            if (!email) {
                return { success: false, error: 'Ошибка входа: email не найден' };
            }
            
            // Входим с email и паролем
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            console.log('Login successful:', user.uid);
            
            // Обновляем статус пользователя
            await usersRef.doc(user.uid).update({
                status: 'online',
                lastSeen: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            return { 
                success: true, 
                user: user,
                userData: userData,
                message: 'Вход выполнен успешно!' 
            };
            
        } catch (error) {
            console.error('Login error:', error.code, error.message);
            
            let errorMessage = 'Ошибка входа';
            
            switch(error.code) {
                case 'auth/user-not-found':
                    errorMessage = 'Пользователь не найден';
                    break;
                case 'auth/wrong-password':
                    errorMessage = 'Неверный пароль';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'Неверный формат данных';
                    break;
                case 'auth/user-disabled':
                    errorMessage = 'Аккаунт отключен';
                    break;
                case 'auth/network-request-failed':
                    errorMessage = 'Проблемы с интернет соединением';
                    break;
            }
            
            return { success: false, error: errorMessage };
        }
    },

    // Создание домашнего сервера
    async createHomeServer(userId, username) {
        try {
            const serversRef = db.collection('servers');
            const usersRef = db.collection('users');
            
            const serverData = {
                name: `${username}'s Server`,
                ownerId: userId,
                members: [userId],
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            const serverRef = await serversRef.add(serverData);
            console.log('Home server created:', serverRef.id);
            
            // Обновляем список серверов пользователя
            await usersRef.doc(userId).update({
                servers: firebase.firestore.FieldValue.arrayUnion(serverRef.id)
            });
            
            // Создаем каналы
            await this.createChannel(serverRef.id, 'general', 'text', userId);
            await this.createChannel(serverRef.id, 'chat', 'text', userId);
            
            return serverRef.id;
            
        } catch (error) {
            console.error('Error creating home server:', error);
        }
    },

    // Создание канала
    async createChannel(serverId, name, type, creatorId) {
        try {
            const channelsRef = db.collection('channels');
            await channelsRef.add({
                serverId: serverId,
                name: name,
                type: type,
                creatorId: creatorId,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                topic: 'Добро пожаловать!'
            });
            console.log('Channel created:', name);
        } catch (error) {
            console.error('Error creating channel:', error);
        }
    },

    // Получение данных пользователя
    async getUserData(userId) {
        try {
            const usersRef = db.collection('users');
            const doc = await usersRef.doc(userId).get();
            return doc.exists ? doc.data() : null;
        } catch (error) {
            console.error('Error getting user data:', error);
            return null;
        }
    },

    // Получение серверов пользователя
    async getUserServers(userId) {
        try {
            const usersRef = db.collection('users');
            const userDoc = await usersRef.doc(userId).get();
            if (!userDoc.exists) return [];
            
            const userData = userDoc.data();
            const serverIds = userData.servers || [];
            
            if (serverIds.length === 0) return [];
            
            const serversRef = db.collection('servers');
            const servers = [];
            
            for (const serverId of serverIds) {
                const serverDoc = await serversRef.doc(serverId).get();
                if (serverDoc.exists) {
                    servers.push({ id: serverId, ...serverDoc.data() });
                }
            }
            
            return servers;
            
        } catch (error) {
            console.error('Error getting user servers:', error);
            return [];
        }
    },

    // Создание нового сервера
    async createServer(name, ownerId, icon = null) {
        try {
            const serversRef = db.collection('servers');
            const usersRef = db.collection('users');
            
            const serverData = {
                name: name,
                ownerId: ownerId,
                members: [ownerId],
                icon: icon || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=7289da&color=fff`,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            const serverRef = await serversRef.add(serverData);
            
            // Обновляем список серверов пользователя
            await usersRef.doc(ownerId).update({
                servers: firebase.firestore.FieldValue.arrayUnion(serverRef.id)
            });
            
            // Создаем общий канал
            await this.createChannel(serverRef.id, 'general', 'text', ownerId);
            
            return { success: true, serverId: serverRef.id };
            
        } catch (error) {
            console.error('Error creating server:', error);
            return { success: false, error: 'Ошибка создания сервера' };
        }
    },

    // Отправка сообщения
    async sendMessage(channelId, userId, content) {
        try {
            const messagesRef = db.collection('messages');
            await messagesRef.add({
                channelId: channelId,
                userId: userId,
                content: content,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                edited: false
            });
            return { success: true };
            
        } catch (error) {
            console.error('Error sending message:', error);
            return { success: false, error: 'Ошибка отправки сообщения' };
        }
    },

    // Получение сообщений
    async getMessages(channelId, limit = 50) {
        try {
            const messagesRef = db.collection('messages');
            const snapshot = await messagesRef
                .where('channelId', '==', channelId)
                .orderBy('timestamp', 'desc')
                .limit(limit)
                .get();
            
            const messages = [];
            snapshot.forEach(doc => {
                messages.push({ id: doc.id, ...doc.data() });
            });
            
            return messages.reverse();
            
        } catch (error) {
            console.error('Error getting messages:', error);
            return [];
        }
    },

    // Выход из системы
    async logoutUser(userId) {
        try {
            if (userId) {
                const usersRef = db.collection('users');
                await usersRef.doc(userId).update({
                    status: 'offline',
                    lastSeen: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
            
            await auth.signOut();
            return { success: true };
            
        } catch (error) {
            console.error('Logout error:', error);
            return { success: false, error: 'Ошибка выхода' };
        }
    },

    // Слушатель состояния аутентификации
    onAuthStateChanged(callback) {
        return auth.onAuthStateChanged(callback);
    }
};
