import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc, addDoc, setDoc, updateDoc, onSnapshot, collection, query, orderBy, limit, deleteDoc, getDocs } from 'firebase/firestore';

// Firebase configuration and global variables
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Initialize Firebase App
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Image generation API details
const IMAGE_GEN_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=`;
const IMAGE_PROMPTS = [
    "قلم رصاص بسيط", // Simple pencil
    "لوحة مفاتيح كمبيوتر", // Computer keyboard
    "منزل ريفي", // Country house
    "غيوم في سماء زرقاء", // Clouds in a blue sky
    "شمس مشرقة", // Bright sun
    "إبرة خياطة", // Sewing needle
    "كوب قهوة", // Coffee cup
    "كتاب مفتوح", // Open book
    "كرسي خشبي", // Wooden chair
    "شجرة خضراء", // Green tree
    "سيارة حمراء", // Red car
    "تفاحة خضراء", // Green apple
    "موزة صفراء", // Yellow banana
    "هاتف ذكي", // Smartphone
    "ساعة يد", // Wristwatch
    "كرة قدم", // Football
    "جيتار صوتي", // Acoustic guitar
    "كاميرا قديمة", // Old camera
    "دراجة هوائية", // Bicycle
    "قارب صغير", // Small boat
    "جبل ثلجي", // Snowy mountain
    "نهر هادئ", // Calm river
    "زهرة عباد الشمس", // Sunflower
    "فراشة ملونة", // Colorful butterfly
    "قطة لطيفة", // Cute cat
    "كلب ودود", // Friendly dog
    "بومة حكيمة", // Wise owl
    "سمكة ذهبية", // Goldfish
    "برج إيفل", // Eiffel Tower
    "أهرامات الجيزة" // Pyramids of Giza
];

// Main App Component
const App = () => {
    const [user, setUser] = useState(null);
    const [userId, setUserId] = useState(null);
    const [currentScreen, setCurrentScreen] = useState('main'); // 'main', 'createRoom', 'joinRoom', 'gameRoom'
    const [roomCode, setRoomCode] = useState('');
    const [playerName, setPlayerName] = useState('');
    const [roomData, setRoomData] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [playerImage, setPlayerImage] = useState(''); // Image assigned to this player
    const [opponentImage, setOpponentImage] = useState(''); // Image assigned to opponent
    const [loadingImage, setLoadingImage] = useState(false);
    const [showGuessInput, setShowGuessInput] = useState(false);
    const [guessText, setGuessText] = useState('');
    const [messageBox, setMessageBox] = useState({ show: false, message: '', type: '' }); // type: 'success', 'error', 'info'

    const messagesEndRef = useRef(null);

    // Scroll to bottom of messages
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    // Firebase Authentication and Initialization
    useEffect(() => {
        const initializeAuth = async () => {
            try {
                if (initialAuthToken) {
                    await signInWithCustomToken(auth, initialAuthToken);
                } else {
                    await signInAnonymously(auth);
                }
            } catch (error) {
                console.error("Error signing in:", error);
                showMessage("حدث خطأ أثناء تسجيل الدخول. يرجى المحاولة مرة أخرى.", "error");
            }
        };

        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setUserId(currentUser?.uid || crypto.randomUUID()); // Use uid if authenticated, otherwise a random ID
        });

        initializeAuth();
        return () => unsubscribe();
    }, []);

    // Listen for room data changes
    useEffect(() => {
        if (!roomCode || !userId) return;

        const roomDocRef = doc(db, `artifacts/${appId}/public/data/rooms`, roomCode);
        const unsubscribeRoom = onSnapshot(roomDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setRoomData(data);
                // Assign images based on player ID
                if (data.player1Id === userId) {
                    setPlayerImage(data.player1Image || '');
                    setOpponentImage(data.player2Image || '');
                } else if (data.player2Id === userId) {
                    setPlayerImage(data.player2Image || '');
                    setOpponentImage(data.player1Image || '');
                }
            } else {
                setRoomData(null);
                showMessage("الغرفة غير موجودة أو تم حذفها.", "error");
                setCurrentScreen('main'); // Go back to main if room is deleted
            }
        }, (error) => {
            console.error("Error listening to room data:", error);
            showMessage("حدث خطأ أثناء تحميل بيانات الغرفة.", "error");
        });

        const messagesColRef = collection(db, `artifacts/${appId}/public/data/rooms`, roomCode, 'messages');
        const q = query(messagesColRef, orderBy('timestamp', 'asc'), limit(100)); // Limit messages for performance
        const unsubscribeMessages = onSnapshot(q, (snapshot) => {
            const msgs = [];
            snapshot.forEach(doc => msgs.push(doc.data()));
            setMessages(msgs);
        }, (error) => {
            console.error("Error listening to messages:", error);
            showMessage("حدث خطأ أثناء تحميل الرسائل.", "error");
        });

        return () => {
            unsubscribeRoom();
            unsubscribeMessages();
        };
    }, [roomCode, userId]);

    // Scroll to bottom when messages change
    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Show message box
    const showMessage = (msg, type) => {
        setMessageBox({ show: true, message: msg, type: type });
        setTimeout(() => {
            setMessageBox({ show: false, message: '', type: '' });
        }, 3000); // Hide after 3 seconds
    };

    // Generate a random room code
    const generateRoomCode = () => {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    };

    // Create a new room
    const handleCreateRoom = async () => {
        if (!playerName.trim()) {
            showMessage("الرجاء إدخال اسمك.", "error");
            return;
        }
        if (!userId) {
            showMessage("لم يتم تهيئة المستخدم بعد. يرجى المحاولة مرة أخرى.", "error");
            return;
        }

        const newRoomCode = generateRoomCode();
        const roomDocRef = doc(db, `artifacts/${appId}/public/data/rooms`, newRoomCode);

        try {
            await setDoc(roomDocRef, {
                roomCode: newRoomCode,
                player1Id: userId,
                player1Name: playerName.trim(),
                player1Score: 0,
                player2Id: null,
                player2Name: null,
                player2Score: 0,
                gameStarted: false,
                player1Image: '',
                player2Image: '',
                createdAt: new Date().toISOString(),
            });
            setRoomCode(newRoomCode);
            setCurrentScreen('gameRoom');
            showMessage(`تم إنشاء الغرفة بنجاح! رمز الغرفة: ${newRoomCode}`, "success");
        } catch (error) {
            console.error("Error creating room:", error);
            showMessage("حدث خطأ أثناء إنشاء الغرفة. يرجى المحاولة مرة أخرى.", "error");
        }
    };

    // Join an existing room
    const handleJoinRoom = async () => {
        if (!roomCode.trim() || !playerName.trim()) {
            showMessage("الرجاء إدخال رمز الغرفة واسمك.", "error");
            return;
        }
        if (!userId) {
            showMessage("لم يتم تهيئة المستخدم بعد. يرجى المحاولة مرة أخرى.", "error");
            return;
        }

        const roomDocRef = doc(db, `artifacts/${appId}/public/data/rooms`, roomCode.trim());
        try {
            const docSnap = await getDoc(roomDocRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.player1Id && data.player2Id) {
                    showMessage("الغرفة ممتلئة بالفعل.", "error");
                    return;
                }
                if (data.player1Id === userId) {
                    showMessage("أنت بالفعل في هذه الغرفة كلاعب 1.", "info");
                    setCurrentScreen('gameRoom');
                    return;
                }

                // Add player 2
                await updateDoc(roomDocRef, {
                    player2Id: userId,
                    player2Name: playerName.trim(),
                });
                setCurrentScreen('gameRoom');
                showMessage("تم الانضمام إلى الغرفة بنجاح!", "success");
            } else {
                showMessage("رمز الغرفة غير صحيح أو الغرفة غير موجودة.", "error");
            }
        } catch (error) {
            console.error("Error joining room:", error);
            showMessage("حدث خطأ أثناء الانضمام إلى الغرفة. يرجى المحاولة مرة أخرى.", "error");
        }
    };

    // Send a chat message
    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !roomCode || !userId || !playerName) return;

        const messagesColRef = collection(db, `artifacts/${appId}/public/data/rooms`, roomCode, 'messages');
        try {
            await addDoc(messagesColRef, {
                senderId: userId,
                senderName: playerName,
                text: newMessage.trim(),
                timestamp: Date.now(),
            });
            setNewMessage('');
        } catch (error) {
            console.error("Error sending message:", error);
            showMessage("حدث خطأ أثناء إرسال الرسالة.", "error");
        }
    };

    // Generate images for the game
    const generateAndAssignImages = async (currentRoomData) => {
        setLoadingImage(true);
        try {
            // Select two distinct random prompts
            const prompt1 = IMAGE_PROMPTS[Math.floor(Math.random() * IMAGE_PROMPTS.length)];
            let prompt2 = prompt1;
            while (prompt2 === prompt1) {
                prompt2 = IMAGE_PROMPTS[Math.floor(Math.random() * IMAGE_PROMPTS.length)];
            }

            // Generate images
            const generateImage = async (prompt) => {
                const payload = { instances: { prompt: prompt }, parameters: { "sampleCount": 1 } };
                const response = await fetch(IMAGE_GEN_API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const result = await response.json();
                if (result.predictions && result.predictions.length > 0 && result.predictions[0].bytesBase64Encoded) {
                    return `data:image/png;base64,${result.predictions[0].bytesBase64Encoded}`;
                } else {
                    throw new Error("Failed to generate image.");
                }
            };

            const [img1, img2] = await Promise.all([
                generateImage(prompt1),
                generateImage(prompt2)
            ]);

            // Assign images to players
            const roomDocRef = doc(db, `artifacts/${appId}/public/data/rooms`, roomCode);
            await updateDoc(roomDocRef, {
                player1Image: img1,
                player2Image: img2,
                player1Prompt: prompt1, // Store prompt for guessing
                player2Prompt: prompt2, // Store prompt for guessing
                gameStarted: true,
                // Reset scores for a new round if needed, or keep them for overall game
                // player1Score: 0,
                // player2Score: 0,
            });
            showMessage("تم إنشاء صور جديدة بنجاح!", "success");
        } catch (error) {
            console.error("Error generating or assigning images:", error);
            showMessage("حدث خطأ أثناء إنشاء الصور. يرجى المحاولة مرة أخرى.", "error");
        } finally {
            setLoadingImage(false);
        }
    };

    // Start the game
    const handleStartGame = async () => {
        if (!roomData || !roomData.player1Id || !roomData.player2Id) {
            showMessage("يجب أن يكون هناك لاعبان لبدء اللعبة.", "error");
            return;
        }
        await generateAndAssignImages(roomData);
    };

    // Change images during the game
    const handleChangeImages = async () => {
        if (!roomData || !roomData.player1Id || !roomData.player2Id) {
            showMessage("يجب أن يكون هناك لاعبان لتغيير الصور.", "error");
            return;
        }
        await generateAndAssignImages(roomData);
    };

    // Handle a player's guess
    const handleGuess = async () => {
        if (!guessText.trim()) {
            showMessage("الرجاء إدخال تخمينك.", "error");
            return;
        }

        const roomDocRef = doc(db, `artifacts/${appId}/public/data/rooms`, roomCode);
        let opponentPrompt = '';
        let currentPlayerScoreField = '';

        if (roomData.player1Id === userId) {
            opponentPrompt = roomData.player2Prompt;
            currentPlayerScoreField = 'player1Score';
        } else if (roomData.player2Id === userId) {
            opponentPrompt = roomData.player1Prompt;
            currentPlayerScoreField = 'player2Score';
        } else {
            showMessage("خطأ: لا يوجد لاعب مطابق.", "error");
            return;
        }

        // Simple check: if the guess text contains the opponent's prompt text (case-insensitive)
        const isCorrect = opponentPrompt && guessText.toLowerCase().includes(opponentPrompt.toLowerCase());

        if (isCorrect) {
            const currentScore = roomData[currentPlayerScoreField] || 0;
            await updateDoc(roomDocRef, {
                [currentPlayerScoreField]: currentScore + 1,
                gameStarted: false, // End the round
                lastWinnerId: userId, // Store winner for display
                lastWinnerName: playerName,
            });
            showMessage("تخمين صحيح! لقد ربحت هذه الجولة.", "success");
            setShowGuessInput(false);
            setGuessText('');
        } else {
            showMessage("تخمين خاطئ. حاول مرة أخرى!", "error");
        }
    };

    // End the game (resets game state and shows final scores)
    const handleEndGame = async () => {
        if (!roomData) return;

        const roomDocRef = doc(db, `artifacts/${appId}/public/data/rooms`, roomCode);
        try {
            await updateDoc(roomDocRef, {
                gameStarted: false,
                player1Image: '',
                player2Image: '',
                player1Prompt: '',
                player2Prompt: '',
                // Optionally reset scores or keep them for overall game
                // player1Score: 0,
                // player2Score: 0,
            });
            showMessage("تم إنهاء اللعبة. يمكنك بدء جولة جديدة أو مغادرة الغرفة.", "info");
            setShowGuessInput(false);
            setGuessText('');
        } catch (error) {
            console.error("Error ending game:", error);
            showMessage("حدث خطأ أثناء إنهاء اللعبة.", "error");
        }
    };

    // Leave the room
    const handleLeaveRoom = async () => {
        if (!roomCode || !userId) {
            setCurrentScreen('main');
            setRoomCode('');
            setRoomData(null);
            setMessages([]);
            setPlayerImage('');
            setOpponentImage('');
            return;
        }

        const roomDocRef = doc(db, `artifacts/${appId}/public/data/rooms`, roomCode);
        try {
            const docSnap = await getDoc(roomDocRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.player1Id === userId) {
                    // If player 1 leaves, promote player 2 to player 1
                    await updateDoc(roomDocRef, {
                        player1Id: data.player2Id || null,
                        player1Name: data.player2Name || null,
                        player1Score: data.player2Score || 0,
                        player1Image: data.player2Image || '',
                        player1Prompt: data.player2Prompt || '',
                        player2Id: null,
                        player2Name: null,
                        player2Score: 0,
                        player2Image: '',
                        player2Prompt: '',
                        gameStarted: false,
                    });
                    // If player 2 also leaves (or was never there), delete the room
                    if (!data.player2Id) {
                        await deleteDoc(roomDocRef);
                    }
                } else if (data.player2Id === userId) {
                    // If player 2 leaves, clear player 2 data
                    await updateDoc(roomDocRef, {
                        player2Id: null,
                        player2Name: null,
                        player2Score: 0,
                        player2Image: '',
                        player2Prompt: '',
                        gameStarted: false,
                    });
                }
                // Delete all messages in the subcollection
                const messagesColRef = collection(db, `artifacts/${appId}/public/data/rooms`, roomCode, 'messages');
                const q = query(messagesColRef);
                const snapshot = await getDocs(q);
                const deletePromises = [];
                snapshot.forEach((doc) => {
                    deletePromises.push(deleteDoc(doc.ref));
                });
                await Promise.all(deletePromises);
            }
        } catch (error) {
            console.error("Error leaving room:", error);
            showMessage("حدث خطأ أثناء مغادرة الغرفة.", "error");
        } finally {
            setCurrentScreen('main');
            setRoomCode('');
            setRoomData(null);
            setMessages([]);
            setPlayerImage('');
            setOpponentImage('');
            setPlayerName(''); // Clear player name on leaving
        }
    };


    // Render different screens based on currentScreen state
    const renderScreen = () => {
        switch (currentScreen) {
            case 'main':
                return (
                    <div className="flex flex-col items-center justify-center h-full p-4 bg-gradient-to-br from-blue-400 to-purple-600 rounded-lg shadow-xl">
                        <h1 className="text-4xl font-extrabold text-white mb-8 text-shadow-lg">لعبة تخمين الصور</h1>
                        <p className="text-lg text-white mb-8 text-center">العب مع أصدقائك وخمنوا الصور!</p>
                        <input
                            type="text"
                            placeholder="أدخل اسمك"
                            value={playerName}
                            onChange={(e) => setPlayerName(e.target.value)}
                            className="w-full max-w-md p-3 mb-4 text-lg text-gray-800 bg-white rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-300 ease-in-out"
                        />
                        <button
                            onClick={() => setCurrentScreen('createRoom')}
                            className="w-full max-w-md p-4 mb-4 text-xl font-bold text-white bg-green-500 rounded-lg shadow-lg hover:bg-green-600 transform hover:scale-105 transition duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-green-700"
                        >
                            إنشاء غرفة
                        </button>
                        <button
                            onClick={() => setCurrentScreen('joinRoom')}
                            className="w-full max-w-md p-4 text-xl font-bold text-white bg-blue-500 rounded-lg shadow-lg hover:bg-blue-600 transform hover:scale-105 transition duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-700"
                        >
                            الدخول على غرفة موجودة
                        </button>
                        {userId && <p className="text-sm text-white mt-4 opacity-75">معرف المستخدم الخاص بك: {userId}</p>}
                    </div>
                );
            case 'createRoom':
                return (
                    <div className="flex flex-col items-center justify-center h-full p-4 bg-gradient-to-br from-green-400 to-teal-600 rounded-lg shadow-xl">
                        <h2 className="text-3xl font-bold text-white mb-6 text-shadow-md">إنشاء غرفة جديدة</h2>
                        <p className="text-lg text-white mb-8 text-center">سيتم إنشاء غرفة جديدة لك ومشاركتك رمزها.</p>
                        <input
                            type="text"
                            placeholder="أدخل اسمك"
                            value={playerName}
                            onChange={(e) => setPlayerName(e.target.value)}
                            className="w-full max-w-md p-3 mb-4 text-lg text-gray-800 bg-white rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-teal-500 transition duration-300 ease-in-out"
                        />
                        <button
                            onClick={handleCreateRoom}
                            className="w-full max-w-md p-4 mb-4 text-xl font-bold text-white bg-blue-500 rounded-lg shadow-lg hover:bg-blue-600 transform hover:scale-105 transition duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-700"
                        >
                            إنشاء الغرفة
                        </button>
                        <button
                            onClick={() => setCurrentScreen('main')}
                            className="w-full max-w-md p-3 text-lg font-semibold text-white bg-gray-500 rounded-lg shadow-md hover:bg-gray-600 transform hover:scale-105 transition duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-gray-700"
                        >
                            العودة
                        </button>
                    </div>
                );
            case 'joinRoom':
                return (
                    <div className="flex flex-col items-center justify-center h-full p-4 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-lg shadow-xl">
                        <h2 className="text-3xl font-bold text-white mb-6 text-shadow-md">الدخول على غرفة موجودة</h2>
                        <p className="text-lg text-white mb-8 text-center">أدخل رمز الغرفة واسمك للانضمام.</p>
                        <input
                            type="text"
                            placeholder="رمز الغرفة"
                            value={roomCode}
                            onChange={(e) => setRoomCode(e.target.value)}
                            className="w-full max-w-md p-3 mb-4 text-lg text-gray-800 bg-white rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition duration-300 ease-in-out"
                        />
                        <input
                            type="text"
                            placeholder="أدخل اسمك"
                            value={playerName}
                            onChange={(e) => setPlayerName(e.target.value)}
                            className="w-full max-w-md p-3 mb-4 text-lg text-gray-800 bg-white rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition duration-300 ease-in-out"
                        />
                        <button
                            onClick={handleJoinRoom}
                            className="w-full max-w-md p-4 mb-4 text-xl font-bold text-white bg-green-500 rounded-lg shadow-lg hover:bg-green-600 transform hover:scale-105 transition duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-green-700"
                        >
                            الدخول إلى الغرفة
                        </button>
                        <button
                            onClick={() => setCurrentScreen('main')}
                            className="w-full max-w-md p-3 text-lg font-semibold text-white bg-gray-500 rounded-lg shadow-md hover:bg-gray-600 transform hover:scale-105 transition duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-gray-700"
                        >
                            العودة
                        </button>
                    </div>
                );
            case 'gameRoom':
                const isPlayer1 = roomData?.player1Id === userId;
                const opponentName = isPlayer1 ? roomData?.player2Name : roomData?.player1Name;
                const player1Score = roomData?.player1Score || 0;
                const player2Score = roomData?.player2Score || 0;
                const myScore = isPlayer1 ? player1Score : player2Score;
                const otherScore = isPlayer1 ? player2Score : player1Score;

                return (
                    <div className="flex flex-col h-full bg-gray-100 rounded-lg shadow-xl overflow-hidden">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-purple-600 to-indigo-700 text-white p-4 flex justify-between items-center shadow-md">
                            <h2 className="text-2xl font-bold">الغرفة: {roomCode}</h2>
                            <div className="flex items-center space-x-4">
                                <span className="text-lg font-semibold">{playerName}: {myScore} نقطة</span>
                                {opponentName && <span className="text-lg font-semibold">{opponentName}: {otherScore} نقطة</span>}
                                {roomData?.lastWinnerName && !roomData.gameStarted && (
                                    <span className="text-lg font-semibold text-yellow-300">
                                        الفائز في الجولة الأخيرة: {roomData.lastWinnerName}
                                    </span>
                                )}
                                <button
                                    onClick={handleLeaveRoom}
                                    className="p-2 bg-red-500 rounded-lg hover:bg-red-600 transition duration-300 ease-in-out text-sm font-semibold"
                                >
                                    مغادرة الغرفة
                                </button>
                            </div>
                        </div>

                        {/* Game Area and Chat */}
                        <div className="flex flex-1 overflow-hidden">
                            {/* Game Section (Images) */}
                            <div className="w-1/2 p-4 flex flex-col items-center justify-center bg-gray-200 border-r border-gray-300">
                                <h3 className="text-xl font-bold text-gray-800 mb-4">صورتي (لا تراها أنت):</h3>
                                {playerImage ? (
                                    <img src={playerImage} alt="My Image" className="w-64 h-64 object-cover rounded-lg shadow-lg mb-4 border-4 border-blue-500" />
                                ) : (
                                    <div className="w-64 h-64 bg-gray-300 rounded-lg flex items-center justify-center text-gray-600 text-center text-sm shadow-inner mb-4">
                                        لا توجد صورة بعد. ابدأ اللعبة!
                                    </div>
                                )}

                                <h3 className="text-xl font-bold text-gray-800 mb-4 mt-8">صورة الخصم (خمنها!):</h3>
                                {opponentImage ? (
                                    <img src={opponentImage} alt="Opponent's Image" className="w-64 h-64 object-cover rounded-lg shadow-lg mb-4 border-4 border-green-500" />
                                ) : (
                                    <div className="w-64 h-64 bg-gray-300 rounded-lg flex items-center justify-center text-gray-600 text-center text-sm shadow-inner mb-4">
                                        لا توجد صورة بعد. ابدأ اللعبة!
                                    </div>
                                )}

                                {loadingImage && (
                                    <div className="mt-4 text-blue-600 font-semibold flex items-center">
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        جاري إنشاء الصور...
                                    </div>
                                )}

                                <div className="flex flex-wrap justify-center gap-4 mt-6">
                                    {roomData?.player1Id && roomData?.player2Id && !roomData.gameStarted && (
                                        <button
                                            onClick={handleStartGame}
                                            className="p-3 bg-purple-500 text-white rounded-lg shadow-md hover:bg-purple-600 transform hover:scale-105 transition duration-300 ease-in-out font-bold"
                                        >
                                            بدء اللعبة
                                        </button>
                                    )}
                                    {roomData?.gameStarted && (
                                        <>
                                            <button
                                                onClick={handleChangeImages}
                                                className="p-3 bg-yellow-500 text-white rounded-lg shadow-md hover:bg-yellow-600 transform hover:scale-105 transition duration-300 ease-in-out font-bold"
                                            >
                                                تغيير الصور
                                            </button>
                                            <button
                                                onClick={() => setShowGuessInput(true)}
                                                className="p-3 bg-blue-500 text-white rounded-lg shadow-md hover:bg-blue-600 transform hover:scale-105 transition duration-300 ease-in-out font-bold"
                                            >
                                                أنا أخمن!
                                            </button>
                                            <button
                                                onClick={handleEndGame}
                                                className="p-3 bg-red-500 text-white rounded-lg shadow-md hover:bg-red-600 transform hover:scale-105 transition duration-300 ease-in-out font-bold"
                                            >
                                                إنهاء اللعبة
                                            </button>
                                        </>
                                    )}
                                </div>

                                {showGuessInput && (
                                    <div className="mt-6 p-4 bg-white rounded-lg shadow-md w-full max-w-md">
                                        <h4 className="text-lg font-semibold mb-2">ما هو تخمينك لصورة الخصم؟</h4>
                                        <input
                                            type="text"
                                            placeholder="اكتب تخمينك هنا"
                                            value={guessText}
                                            onChange={(e) => setGuessText(e.target.value)}
                                            className="w-full p-2 mb-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
                                        />
                                        <div className="flex justify-end space-x-2">
                                            <button
                                                onClick={handleGuess}
                                                className="p-2 bg-green-500 text-white rounded-md hover:bg-green-600 font-semibold"
                                            >
                                                تأكيد التخمين
                                            </button>
                                            <button
                                                onClick={() => setShowGuessInput(false)}
                                                className="p-2 bg-gray-400 text-white rounded-md hover:bg-gray-500 font-semibold"
                                            >
                                                إلغاء
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Chat Section */}
                            <div className="w-1/2 flex flex-col bg-white">
                                <div className="flex-1 p-4 overflow-y-auto custom-scrollbar">
                                    {messages.map((msg, index) => (
                                        <div
                                            key={index}
                                            className={`flex mb-3 ${msg.senderId === userId ? 'justify-end' : 'justify-start'}`}
                                        >
                                            <div
                                                className={`max-w-[70%] p-3 rounded-lg shadow-sm ${
                                                    msg.senderId === userId
                                                        ? 'bg-blue-500 text-white rounded-br-none'
                                                        : 'bg-gray-200 text-gray-800 rounded-bl-none'
                                                }`}
                                            >
                                                <div className="font-semibold text-sm mb-1">
                                                    {msg.senderId === userId ? 'أنت' : msg.senderName}
                                                </div>
                                                <div>{msg.text}</div>
                                                <div className="text-xs opacity-75 mt-1">
                                                    {new Date(msg.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    <div ref={messagesEndRef} />
                                </div>

                                {/* Message Input */}
                                <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-300 bg-gray-50">
                                    <div className="flex items-center">
                                        <input
                                            type="text"
                                            placeholder="اكتب رسالتك..."
                                            value={newMessage}
                                            onChange={(e) => setNewMessage(e.target.value)}
                                            className="flex-1 p-3 border border-gray-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-800"
                                        />
                                        <button
                                            type="submit"
                                            className="p-3 bg-blue-600 text-white rounded-r-lg hover:bg-blue-700 transition duration-300 ease-in-out font-bold shadow-md"
                                        >
                                            إرسال
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gray-900 font-inter">
            <style>
                {`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
                body {
                    font-family: 'Inter', sans-serif;
                }
                .text-shadow-lg {
                    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
                }
                .text-shadow-md {
                    text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.4);
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 8px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: #f1f1f1;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #888;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #555;
                }
                `}
            </style>
            <div className="w-full h-[90vh] max-w-6xl bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col">
                {renderScreen()}
            </div>

            {/* Message Box */}
            {messageBox.show && (
                <div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg text-white font-semibold z-50
                    ${messageBox.type === 'success' ? 'bg-green-500' :
                      messageBox.type === 'error' ? 'bg-red-500' :
                      'bg-blue-500'}`}>
                    {messageBox.message}
                </div>
            )}
        </div>
    );
};

export default App;
