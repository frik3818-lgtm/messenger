// Конфигурация Firebase (замените на свою)
const firebaseConfig = {
    apiKey: "AIzaSyC_your-api-key-here",
    authDomain: "your-project-id.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project-id.appspot.com",
    messagingSenderId: "your-sender-id",
    appId: "1:your-app-id:web:your-app-hash"
};

// Инициализация Firebase
firebase.initializeApp(firebaseConfig);

// Экспорт сервисов
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();
const messaging = firebase.messaging();

// Настройка Firestore
const serversCollection = db.collection('servers');
const channelsCollection = db.collection('channels');
const messagesCollection = db.collection('messages');
const usersCollection = db.collection('users');

// Функции для работы с Firebase
const firebaseApp = {
    // Аутентификация
    async login(email, password) {
        try {
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            return { success: true, user: userCredential.user };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    async register(email, password, username, avatar) {
        try {
            // Создаем пользователя
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            // Сохраняем дополнительные данные
            await usersCollection.doc(user.uid).set({
                uid: user.uid,
                email: user.email,
                username: username || user.email.split('@')[0],
                avatar: avatar || `https://ui-avatars.com/api/?name=${username}&background=5865f2&color=fff`,
                status: 'online',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastSeen: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            return { success: true, user };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    async loginWithGoogle() {
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            const userCredential = await auth.signInWithPopup(provider);
            return { success: true, user: userCredential.user };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    async loginWithGithub() {
        try {
            const provider = new firebase.auth.GithubAuthProvider();
            const userCredential = await auth.signInWithPopup(provider);
            return { success: true, user: userCredential.user };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    async logout() {
        try {
            await auth.signOut();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    // Серверы
    async createServer(name, icon, ownerId) {
        try {
            const serverRef = await serversCollection.add({
                name: name,
                icon: icon || `https://ui-avatars.com/api/?name=${name}&background=5865f2&color=fff`,
                ownerId: ownerId,
                members: [ownerId],
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // Создаем общий канал
            await this.createChannel(serverRef.id, 'general', 'text', ownerId);
            
            return { success: true, serverId: serverRef.id };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    async getServers(userId) {
        try {
            const snapshot = await serversCollection
                .where('members', 'array-contains', userId)
                .orderBy('createdAt', 'desc')
                .get();
            
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Error getting servers:', error);
            return [];
        }
    },

    // Каналы
    async createChannel(serverId, name, type, creatorId) {
        try {
            const channelRef = await channelsCollection.add({
                serverId: serverId,
                name: name,
                type: type,
                creatorId: creatorId,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                topic: type === 'text' ? 'Добро пожаловать в новый канал!' : ''
            });
            
            return { success: true, channelId: channelRef.id };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    async getChannels(serverId) {
        try {
            const snapshot = await channelsCollection
                .where('serverId', '==', serverId)
                .orderBy('createdAt')
                .get();
            
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Error getting channels:', error);
            return [];
        }
    },

    // Сообщения
    async sendMessage(channelId, userId, content, attachments = []) {
        try {
            const messageRef = await messagesCollection.add({
                channelId: channelId,
                userId: userId,
                content: content,
                attachments: attachments,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                edited: false,
                reactions: {}
            });
            
            return { success: true, messageId: messageRef.id };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    async getMessages(channelId, limit = 50) {
        try {
            const snapshot = await messagesCollection
                .where('channelId', '==', channelId)
                .orderBy('timestamp', 'desc')
                .limit(limit)
                .get();
            
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Error getting messages:', error);
            return [];
        }
    },

    // Реальное время - слушатели
    onAuthStateChanged(callback) {
        return auth.onAuthStateChanged(callback);
    },

    onMessages(channelId, callback) {
        return messagesCollection
            .where('channelId', '==', channelId)
            .orderBy('timestamp')
            .onSnapshot(snapshot => {
                const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                callback(messages);
            });
    },

    onUsersPresence(callback) {
        return usersCollection.onSnapshot(snapshot => {
            const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            callback(users);
        });
    },

    // Обновление статуса пользователя
    async updateUserStatus(userId, status) {
        try {
            await usersCollection.doc(userId).update({
                status: status,
                lastSeen: firebase.firestore.FieldValue.serverTimestamp()
            });
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
};
