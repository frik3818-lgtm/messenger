// Конфигурация Firebase (замените на свою)
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

// Коллекции
const usersCollection = db.collection('users');
const serversCollection = db.collection('servers');
const messagesCollection = db.collection('messages');

// Объект для работы с Firebase
const firebaseApp = {
    // Проверка доступности ника
    async checkUsernameAvailability(username) {
        try {
            const snapshot = await usersCollection
                .where('username', '==', username.toLowerCase())
                .limit(1)
                .get();
            
            return {
                available: snapshot.empty,
                message: snapshot.empty ? 'Ник свободен' : 'Ник уже занят'
            };
        } catch (error) {
            console.error('Error checking username:', error);
            return { available: false, message: 'Ошибка проверки' };
        }
    },

    // Упрощенная регистрация (без email подтверждения)
    async registerUserSimple(username, password) {
        try {
            // Проверяем ник
            const usernameCheck = await this.checkUsernameAvailability(username);
            
            if (!usernameCheck.available) {
                return { success: false, error: 'Этот ник уже занят' };
            }
            
            // Создаем уникальный email на основе ника (чтобы обойти проверку Firebase)
            const uniqueEmail = `${username.toLowerCase()}@anubis.local`;
            
            // Создаем пользователя в Firebase Auth
            const userCredential = await auth.createUserWithEmailAndPassword(uniqueEmail, password);
            const user = userCredential.user;
            
            // Обновляем email на пустой (не используется)
            await user.updateEmail("");
            
            // Сохраняем данные в Firestore
            await usersCollection.doc(user.uid).set({
                uid: user.uid,
                username: username.toLowerCase(),
                displayName: username,
                email: "", // Пустой email
                avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=7289da&color=fff`,
                status: 'online',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
                servers: []
            });
            
            // Создаем домашний сервер для пользователя
            await this.createHomeServer(user.uid, username);
            
            return { 
                success: true, 
                user: user,
                message: 'Регистрация прошла успешно!' 
            };
            
        } catch (error) {
            console.error('Registration error:', error);
            
            let errorMessage = 'Ошибка регистрации';
            
            switch(error.code) {
                case 'auth/email-already-in-use':
                    errorMessage = 'Пользователь с таким ником уже существует';
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
            }
            
            return { success: false, error: errorMessage };
        }
    },

    // Упрощенный вход (по нику и паролю)
    async loginUserSimple(username, password) {
        try {
            // Находим пользователя по никнейму
            const snapshot = await usersCollection
                .where('username', '==', username.toLowerCase())
                .limit(1)
                .get();
            
            if (snapshot.empty) {
                return { success: false, error: 'Пользователь не найден' };
            }
            
            // Создаем уникальный email для входа
            const uniqueEmail = `${username.toLowerCase()}@anubis.local`;
            
            // Входим с этим email и паролем
            const userCredential = await auth.signInWithEmailAndPassword(uniqueEmail, password);
            const user = userCredential.user;
            
            // Обновляем статус пользователя
            await usersCollection.doc(user.uid).update({
                status: 'online',
                lastSeen: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            return { 
                success: true, 
                user: user,
                message: 'Вход выполнен успешно!' 
            };
            
        } catch (error) {
            console.error('Login error:', error);
            
            let errorMessage = 'Ошибка входа';
            
            switch(error.code) {
                case 'auth/user-not-found':
                    errorMessage = 'Пользователь не найден';
                    break;
                case 'auth/wrong-password':
                    errorMessage = 'Неверный пароль';
                    break;
                case 'auth/user-disabled':
                    errorMessage = 'Аккаунт отключен';
                    break;
            }
            
            return { success: false, error: errorMessage };
        }
    },

    // Создание домашнего сервера
    async createHomeServer(userId, username) {
        try {
            const serverData = {
                name: `${username}'s Server`,
                ownerId: userId,
                members: [userId],
                channels: ['general', 'chat'],
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            const serverRef = await serversCollection.add(serverData);
            
            // Обновляем список серверов пользователя
            await usersCollection.doc(userId).update({
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
            const channelData = {
                serverId: serverId,
                name: name,
                type: type,
                creatorId: creatorId,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                topic: 'Добро пожаловать!'
            };
            
            const channelsCollection = db.collection('channels');
            await channelsCollection.add(channelData);
            
        } catch (error) {
            console.error('Error creating channel:', error);
        }
    },

    // Получение данных пользователя
    async getUserData(userId) {
        try {
            const doc = await usersCollection.doc(userId).get();
            return doc.exists ? doc.data() : null;
        } catch (error) {
            console.error('Error getting user data:', error);
            return null;
        }
    },

    // Получение серверов пользователя
    async getUserServers(userId) {
        try {
            const userDoc = await usersCollection.doc(userId).get();
            if (!userDoc.exists) return [];
            
            const userData = userDoc.data();
            const serverIds = userData.servers || [];
            
            if (serverIds.length === 0) return [];
            
            const servers = [];
            for (const serverId of serverIds) {
                const serverDoc = await serversCollection.doc(serverId).get();
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
            const serverData = {
                name: name,
                ownerId: ownerId,
                members: [ownerId],
                icon: icon || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=7289da&color=fff`,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            const serverRef = await serversCollection.add(serverData);
            
            // Обновляем список серверов пользователя
            await usersCollection.doc(ownerId).update({
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
            const messageData = {
                channelId: channelId,
                userId: userId,
                content: content,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                edited: false
            };
            
            await messagesCollection.add(messageData);
            return { success: true };
            
        } catch (error) {
            console.error('Error sending message:', error);
            return { success: false, error: 'Ошибка отправки сообщения' };
        }
    },

    // Получение сообщений
    async getMessages(channelId, limit = 50) {
        try {
            const snapshot = await messagesCollection
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

    // Слушатель сообщений в реальном времени
    onMessages(channelId, callback) {
        return messagesCollection
            .where('channelId', '==', channelId)
            .orderBy('timestamp')
            .onSnapshot(snapshot => {
                const messages = [];
                snapshot.forEach(doc => {
                    messages.push({ id: doc.id, ...doc.data() });
                });
                callback(messages);
            });
    },

    // Выход из системы
    async logoutUser(userId) {
        try {
            if (userId) {
                await usersCollection.doc(userId).update({
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
