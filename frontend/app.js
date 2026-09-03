/* =========================================
   SATQUERY AI — APPLICATION LOGIC
   ========================================= */


/* =========================================
   ELEMENTS
   ========================================= */

const uploadButton =
    document.getElementById("uploadButton");

const deleteButton =
    document.getElementById("deleteButton");

const imageInput =
    document.getElementById("imageInput");

const imageGallery =
    document.getElementById("imageGallery");

const emptyState =
    document.getElementById("emptyState");

const fileName =
    document.getElementById("fileName");

const imageSession =
    document.getElementById("imageSession");

const queryInput =
    document.getElementById("queryInput");

const analysisOptions =
    document.querySelectorAll(".analysis-option");

const runButton =
    document.getElementById("runButton");

const runButtonText =
    document.getElementById("runButtonText");

const loadingCircle =
    document.getElementById("loadingCircle");

const continueButton =
    document.getElementById("continueButton");

const clearChatButton =
    document.getElementById("clearChatButton");

const resultView =
    document.getElementById("resultView");

const resultStatus =
    document.getElementById("resultStatus");

const resultQuestionButton =
    document.getElementById("resultQuestionButton");

const clearChatResultButton =
    document.getElementById("clearChatResultButton");

const chatHistory =
    document.getElementById("chatHistory");

const exportButton =
    document.getElementById("exportButton");


/* =========================================
   SIDEBAR
   ========================================= */

const newChatButton =
    document.getElementById("newChatButton");

const chatList =
    document.getElementById("chatList");

const chatSearch =
    document.getElementById("chatSearch");

const chatCount =
    document.getElementById("chatCount");


/* =========================================
   STATE
   ========================================= */

let selectedFiles = [];

let selectedAnalysis = "NDVI";

let questionHistory = [];

let analysisRunning = false;

let currentChatId = null;


/* =========================================
   INDEXEDDB
   ========================================= */

const DB_NAME = "SatQueryDB";

const DB_VERSION = 1;

const STORE_NAME = "chats";


function openDatabase() {

    return new Promise(
        (resolve, reject) => {

            const request =
                indexedDB.open(
                    DB_NAME,
                    DB_VERSION
                );


            request.onupgradeneeded =
                (event) => {

                    const db =
                        event.target.result;

                    if (
                        !db.objectStoreNames
                            .contains(STORE_NAME)
                    ) {

                        const store =
                            db.createObjectStore(
                                STORE_NAME,
                                {
                                    keyPath: "id"
                                }
                            );

                        store.createIndex(
                            "timestamp",
                            "timestamp"
                        );

                    }

                };


            request.onsuccess =
                () => {

                    resolve(
                        request.result
                    );

                };


            request.onerror =
                () => {

                    reject(
                        request.error
                    );

                };

        }
    );

}


/* =========================================
   GET CHAT
   ========================================= */

async function getChat(id) {

    const db =
        await openDatabase();

    return new Promise(
        (resolve, reject) => {

            const transaction =
                db.transaction(
                    STORE_NAME,
                    "readonly"
                );

            const store =
                transaction.objectStore(
                    STORE_NAME
                );

            const request =
                store.get(id);


            request.onsuccess =
                () => {

                    resolve(
                        request.result
                    );

                };


            request.onerror =
                () => {

                    reject(
                        request.error
                    );

                };

        }
    );

}


/* =========================================
   GET ALL CHATS
   ========================================= */

async function getAllChats() {

    const db =
        await openDatabase();

    return new Promise(
        (resolve, reject) => {

            const transaction =
                db.transaction(
                    STORE_NAME,
                    "readonly"
                );

            const store =
                transaction.objectStore(
                    STORE_NAME
                );

            const request =
                store.getAll();


            request.onsuccess =
                () => {

                    const chats =
                        request.result || [];

                    chats.sort(
                        (a, b) =>
                            new Date(b.timestamp) -
                            new Date(a.timestamp)
                    );

                    resolve(chats);

                };


            request.onerror =
                () => {

                    reject(
                        request.error
                    );

                };

        }
    );

}


/* =========================================
   SAVE CHAT
   ========================================= */

async function saveChat() {

    if (!currentChatId) {
        return;
    }


    const chat = {

        id:
            currentChatId,

        title:
            getChatTitle(),

        timestamp:
            new Date(),

        messages:
            questionHistory,

        images:
            selectedFiles.map(
                (file) => ({
                    name:
                        file.name,

                    type:
                        file.type,

                    size:
                        file.size,

                    lastModified:
                        file.lastModified,

                    blob:
                        file
                })
            )

    };


    const db =
        await openDatabase();


    return new Promise(
        (resolve, reject) => {

            const transaction =
                db.transaction(
                    STORE_NAME,
                    "readwrite"
                );

            const store =
                transaction.objectStore(
                    STORE_NAME
                );

            const request =
                store.put(chat);


            request.onsuccess =
                () => {

                    resolve();

                    renderChatList();

                };


            request.onerror =
                () => {

                    reject(
                        request.error
                    );

                };

        }
    );

}


/* =========================================
   DELETE STORED CHAT
   ========================================= */

async function deleteStoredChat(id) {

    const db =
        await openDatabase();


    return new Promise(
        (resolve, reject) => {

            const transaction =
                db.transaction(
                    STORE_NAME,
                    "readwrite"
                );

            const store =
                transaction.objectStore(
                    STORE_NAME
                );

            const request =
                store.delete(id);


            request.onsuccess =
                () => {

                    resolve();

                };


            request.onerror =
                () => {

                    reject(
                        request.error
                    );

                };

        }
    );

}


/* =========================================
   CREATE CHAT ID
   ========================================= */

function createChatId() {

    return (
        "chat-" +
        Date.now() +
        "-" +
        Math.random()
            .toString(36)
            .substring(2, 9)
    );

}


/* =========================================
   CHAT TITLE
   ========================================= */

function getChatTitle() {

    if (
        questionHistory.length === 0
    ) {

        return "New Chat";

    }


    const firstQuestion =
        questionHistory[0].question;


    if (
        firstQuestion.length > 32
    ) {

        return (
            firstQuestion.substring(
                0,
                32
            ) +
            "..."
        );

    }


    return firstQuestion;

}


/* =========================================
   START NEW CHAT
   ========================================= */

async function startNewChat() {

    currentChatId =
        createChatId();

    selectedFiles = [];

    selectedAnalysis =
        "NDVI";

    questionHistory = [];

    analysisRunning =
        false;


    if (imageInput) {
        imageInput.value = "";
    }


    if (imageGallery) {

        imageGallery.innerHTML =
            "";

        imageGallery.className =
            "image-gallery";

    }


    if (chatHistory) {
        chatHistory.innerHTML =
            "";
    }


    if (resultView) {

        resultView.classList.remove(
            "visible"
        );

    }


    if (continueButton) {

        continueButton.classList.remove(
            "visible"
        );

    }


    if (emptyState) {

        emptyState.style.display =
            "block";

    }


    if (queryInput) {

        queryInput.value =
            "";

    }


    updateImageSession();

    renderChatList();

}


/* =========================================
   NEW CHAT BUTTON
   ========================================= */

if (newChatButton) {

    newChatButton.addEventListener(
        "click",
        startNewChat
    );

}


/* =========================================
   UPLOAD BUTTON
   ========================================= */

if (
    uploadButton &&
    imageInput
) {

    uploadButton.addEventListener(
        "click",
        () => {

            imageInput.click();

        }
    );

}


/* =========================================
   IMAGE SELECTION
   ========================================= */

if (imageInput) {

    imageInput.addEventListener(
        "change",
        async () => {

            const files =
                Array.from(
                    imageInput.files
                );


            if (
                files.length === 0
            ) {

                return;

            }


            /*
               CREATE CHAT IF NEEDED
            */

            if (!currentChatId) {

                currentChatId =
                    createChatId();

            }


            /*
               ADD NEW FILES
            */

            files.forEach(
                (file) => {

                    const alreadyExists =
                        selectedFiles.some(
                            (existingFile) =>

                                existingFile.name ===
                                file.name &&

                                existingFile.size ===
                                file.size &&

                                existingFile.lastModified ===
                                file.lastModified
                        );


                    if (
                        !alreadyExists
                    ) {

                        selectedFiles.push(
                            file
                        );

                    }

                }
            );


            /*
               RESET INPUT
            */

            imageInput.value =
                "";


            /*
               RENDER
            */

            renderImageGallery();

            updateImageSession();


            /*
               SHOW IMAGE VIEW
            */

            if (resultView) {

                resultView.classList.remove(
                    "visible"
                );

            }


            if (imageGallery) {

                imageGallery.classList.add(
                    "visible"
                );

            }


            /*
               IMPORTANT:
               DO NOT CLEAR CHAT HISTORY.

               Existing conversation stays
               when additional images are
               uploaded.
            */

            await saveChat();

        }
    );

}


/* =========================================
   RENDER IMAGE GALLERY
   ========================================= */

function renderImageGallery() {

    if (!imageGallery) {
        return;
    }


    imageGallery.innerHTML =
        "";


    if (
        selectedFiles.length === 0
    ) {

        imageGallery.className =
            "image-gallery";

        return;

    }


    imageGallery.className =
        "image-gallery visible";


    imageGallery.classList.remove(
        "single",
        "double",
        "triple",
        "multi"
    );


    /*
       SELECT LAYOUT
    */

    if (
        selectedFiles.length === 1
    ) {

        imageGallery.classList.add(
            "single"
        );

    }

    else if (
        selectedFiles.length === 2
    ) {

        imageGallery.classList.add(
            "double"
        );

    }

    else if (
        selectedFiles.length === 3
    ) {

        imageGallery.classList.add(
            "triple"
        );

    }

    else {

        imageGallery.classList.add(
            "multi"
        );

    }


    /*
       CREATE IMAGE CARDS
    */

    selectedFiles.forEach(
        (file, index) => {

            const card =
                document.createElement(
                    "div"
                );

            card.className =
                "image-card";


            /*
               IMAGE
            */

            const img =
                document.createElement(
                    "img"
                );

            const objectURL =
                URL.createObjectURL(
                    file
                );

            img.src =
                objectURL;

            img.alt =
                file.name;


            /*
               IMAGE NUMBER
            */

            const number =
                document.createElement(
                    "div"
                );

            number.className =
                "image-number";

            number.textContent =
                `IMAGE ${index + 1}`;


            /*
               REMOVE BUTTON
            */

            const removeButton =
                document.createElement(
                    "button"
                );

            removeButton.className =
                "remove-image";

            removeButton.type =
                "button";

            removeButton.setAttribute(
                "aria-label",
                `Remove image ${index + 1}`
            );

            removeButton.textContent =
                "×";


            /*
               REMOVE ONLY THIS IMAGE
            */

            removeButton.addEventListener(
                "click",
                (event) => {

                    event.preventDefault();

                    event.stopPropagation();

                    removeImage(index);

                }
            );


            /*
               BUILD CARD
            */

            card.appendChild(
                img
            );

            card.appendChild(
                number
            );

            card.appendChild(
                removeButton
            );


            imageGallery.appendChild(
                card
            );

        }
    );

}


/* =========================================
   REMOVE ONE IMAGE
   ========================================= */

async function removeImage(index) {

    if (
        index < 0 ||
        index >= selectedFiles.length
    ) {

        return;

    }


    selectedFiles.splice(
        index,
        1
    );


    renderImageGallery();

    updateImageSession();


    /*
       NO IMAGES LEFT
    */

    if (
        selectedFiles.length === 0
    ) {

        questionHistory =
            [];

        if (chatHistory) {

            chatHistory.innerHTML =
                "";

        }


        if (resultView) {

            resultView.classList.remove(
                "visible"
            );

        }


        if (continueButton) {

            continueButton.classList.remove(
                "visible"
            );

        }

    }


    await saveChat();

}


/* =========================================
   UPDATE IMAGE SESSION
   ========================================= */

function updateImageSession() {

    const count =
        selectedFiles.length;


    /*
       NO IMAGES
    */

    if (count === 0) {

        if (fileName) {

            fileName.textContent =
                "";

        }


        if (imageSession) {

            imageSession.textContent =
                "No imagery loaded.";

            imageSession.classList.remove(
                "active"
            );

        }


        if (deleteButton) {

            deleteButton.classList.remove(
                "visible"
            );

        }


        if (clearChatButton) {

            clearChatButton.classList.remove(
                "visible"
            );

        }


        if (emptyState) {

            emptyState.style.display =
                "block";

        }


        return;

    }


    /*
       IMAGES EXIST
    */

    if (emptyState) {

        emptyState.style.display =
            "none";

    }


    if (deleteButton) {

        deleteButton.classList.add(
            "visible"
        );

    }


    if (clearChatButton) {

        clearChatButton.classList.add(
            "visible"
        );

    }


    /*
       FILE NAME / COUNT
    */

    if (fileName) {

        if (count === 1) {

            fileName.textContent =
                selectedFiles[0].name;

        }

        else {

            fileName.textContent =
                `${count} images selected`;

        }

    }


    /*
       SESSION STATUS
    */

    if (imageSession) {

        if (count === 1) {

            imageSession.textContent =
                "1 image loaded — ready for questions.";

        }

        else {

            imageSession.textContent =
                `${count} images loaded — ready for analysis.`;

        }


        imageSession.classList.add(
            "active"
        );

    }

}


/* =========================================
   DELETE ALL IMAGES
   ========================================= */

if (deleteButton) {

    deleteButton.addEventListener(
        "click",
        async () => {

            selectedFiles =
                [];

            if (imageInput) {

                imageInput.value =
                    "";

            }


            if (imageGallery) {

                imageGallery.innerHTML =
                    "";

                imageGallery.className =
                    "image-gallery";

            }


            /*
               Keep current chat.
            */

            if (resultView) {

                resultView.classList.remove(
                    "visible"
                );

            }


            if (chatHistory) {

                chatHistory.innerHTML =
                    "";

            }


            questionHistory =
                [];


            if (continueButton) {

                continueButton.classList.remove(
                    "visible"
                );

            }


            updateImageSession();

            await saveChat();

        }
    );

}


/* =========================================
   ANALYSIS TYPE
   ========================================= */

analysisOptions.forEach(
    (option) => {

        option.addEventListener(
            "click",
            () => {

                analysisOptions.forEach(
                    (item) => {

                        item.classList.remove(
                            "active"
                        );

                    }
                );


                option.classList.add(
                    "active"
                );


                selectedAnalysis =
                    option.dataset.analysis;

            }
        );

    }
);


/* =========================================
   RUN BUTTON
   ========================================= */

if (runButton) {

    runButton.addEventListener(
        "click",
        () => {

            runAnalysis();

        }
    );

}


/* =========================================
   ENTER KEY
   ========================================= */

if (queryInput) {

    queryInput.addEventListener(
        "keydown",
        (event) => {

            if (
                event.key === "Enter" &&
                !event.shiftKey
            ) {

                event.preventDefault();

                runAnalysis();

            }

        }
    );

}


/* =========================================
   RUN ANALYSIS
   ========================================= */

async function runAnalysis() {

    /*
       DON'T ALLOW DUPLICATE REQUEST
    */

    if (analysisRunning) {
        return;
    }


    /*
       IMAGE REQUIRED
    */

    if (
        selectedFiles.length === 0
    ) {

        alert(
            "Please upload at least one satellite image first."
        );

        return;

    }


    /*
       QUESTION REQUIRED
    */

    const query =
        queryInput.value.trim();


    if (!query) {

        alert(
            "Please enter a question first."
        );

        queryInput.focus();

        return;

    }


    /*
       CREATE CHAT IF NEEDED
    */

    if (!currentChatId) {

        currentChatId =
            createChatId();

    }


    /*
       START ANALYSIS
    */

    analysisRunning =
        true;


    /*
       IMPORTANT:
       Save the actual images used
       by THIS question.
    */

    const conversation = {

        question:
            query,

        analysis:
            selectedAnalysis,

        imageCount:
            selectedFiles.length,

        files:
            [...selectedFiles],

        timestamp:
            new Date(),

        answer:
            null

    };


    questionHistory.push(
        conversation
    );


    /*
       BUTTON STATE
    */

    if (runButton) {

        runButton.disabled =
            true;

    }


    if (runButtonText) {

        runButtonText.textContent =
            "Analyzing...";

    }


    if (loadingCircle) {

        loadingCircle.classList.add(
            "loading"
        );

    }


    /*
       HIDE LARGE IMAGE VIEW
    */

    if (imageGallery) {

        imageGallery.classList.remove(
            "visible"
        );

    }


    /*
       SHOW RESULT VIEW
    */

    if (resultView) {

        resultView.classList.add(
            "visible"
        );

    }


    /*
       STATUS
    */

    if (resultStatus) {

        resultStatus.textContent =
            "PROCESSING";

    }


    /*
       ADD QUESTION
    */

    addQuestionMessage(
        conversation
    );


    /*
       LOADING MESSAGE
    */

    const loadingMessage =
        addLoadingMessage(
            conversation
        );


    scrollChatToBottom();


    /*
       SAVE CHAT
    */

    await saveChat();


    /*
       =====================================
       TEMPORARY API SIMULATION
       =====================================

       Replace this setTimeout with
       your real API call later.
    */

    setTimeout(
        async () => {

            /*
               REMOVE LOADING
            */

            if (loadingMessage) {

                loadingMessage.remove();

            }


            /*
               TEMPORARY ANSWER
            */

            const answerText =
                getTemporaryAnswer(
                    conversation
                );


            conversation.answer =
                answerText;


            /*
               ADD ANSWER
            */

            addAnswerMessage(
                conversation
            );


            /*
               COMPLETE
            */

            if (resultStatus) {

                resultStatus.textContent =
                    "COMPLETE";

            }


            if (runButton) {

                runButton.disabled =
                    false;

            }


            if (runButtonText) {

                runButtonText.textContent =
                    "Run Analysis";

            }


            if (loadingCircle) {

                loadingCircle.classList.remove(
                    "loading"
                );

            }


            analysisRunning =
                false;


            /*
               SAVE UPDATED ANSWER
            */

            await saveChat();


            /*
               ALLOW ANOTHER QUESTION
            */

            if (continueButton) {

                continueButton.classList.add(
                    "visible"
                );

            }


            /*
               CLEAR INPUT
            */

            queryInput.value =
                "";


            /*
               FOCUS
            */

            queryInput.focus();


            /*
               SCROLL
            */

            scrollChatToBottom();

        },
        1800
    );

}


/* =========================================
   TEMPORARY ANSWER
   ========================================= */

function getTemporaryAnswer(
    data
) {

    return (
        `Analysis completed for "${data.question}". ` +
        `The ${data.analysis} workflow processed ` +
        `${data.imageCount} image` +
        `${data.imageCount > 1 ? "s" : ""}. ` +
        `The real satellite-analysis API response ` +
        `will appear here once connected.`
    );

}


/* =========================================
   ADD USER QUESTION
   ========================================= */

function addQuestionMessage(
    data
) {

    const message =
        document.createElement(
            "div"
        );


    message.className =
        "chat-message user-message";


    /*
       IMAGE PREVIEW
    */

    const imagePreview =
        document.createElement(
            "div"
        );

    imagePreview.className =
        "question-image-preview";


    /*
       ADD ALL IMAGES USED
       FOR THIS QUESTION
    */

    if (
        data.files &&
        data.files.length > 0
    ) {

        data.files.forEach(
            (file) => {

                const wrapper =
                    document.createElement(
                        "div"
                    );

                wrapper.className =
                    "question-image-wrapper";


                const img =
                    document.createElement(
                        "img"
                    );


                const objectURL =
                    URL.createObjectURL(
                        file
                    );


                img.src =
                    objectURL;


                img.alt =
                    file.name;


                img.title =
                    "Click to view image";


                /*
                   OPEN LARGE IMAGE
                */

                img.addEventListener(
                    "click",
                    () => {

                        window.open(
                            objectURL,
                            "_blank"
                        );

                    }
                );


                wrapper.appendChild(
                    img
                );


                imagePreview.appendChild(
                    wrapper
                );

            }
        );

    }


    /*
       QUESTION CONTENT
    */

    const content =
        document.createElement(
            "div"
        );


    content.className =
        "question-content";


    content.innerHTML = `

        <div class="message-label">
            YOU
        </div>

        <div class="message-question">
            ${escapeHTML(data.question)}
        </div>

        <div class="message-analysis">
            ${escapeHTML(data.analysis)}
            · ${data.imageCount}
            image${data.imageCount > 1 ? "s" : ""}
        </div>

    `;


    /*
       BUILD MESSAGE
    */

    message.appendChild(
        imagePreview
    );


    message.appendChild(
        content
    );


    chatHistory.appendChild(
        message
    );


    return message;

}


/* =========================================
   LOADING MESSAGE
   ========================================= */

function addLoadingMessage(
    data
) {

    const message =
        document.createElement(
            "div"
        );


    message.className =
        "chat-message ai-message";


    message.innerHTML = `

        <div class="message-label">
            SATQUERY AI
        </div>

        <h3>
            Analyzing...
        </h3>

        <p>
            Processing
            ${data.imageCount}
            image${data.imageCount > 1 ? "s" : ""}
            and generating insights.
        </p>

    `;


    chatHistory.appendChild(
        message
    );


    return message;

}


/* =========================================
   ADD AI ANSWER
   ========================================= */

function addAnswerMessage(
    data
) {

    const message =
        document.createElement(
            "div"
        );


    message.className =
        "chat-message ai-message";


    message.innerHTML = `

        <div class="message-label">
            SATQUERY AI
        </div>

        <h3>
            ${escapeHTML(data.analysis)}
            Analysis
        </h3>

        <p>
            ${escapeHTML(
                data.answer ||
                getTemporaryAnswer(data)
            )}
        </p>

    `;


    chatHistory.appendChild(
        message
    );


    return message;

}


/* =========================================
   ASK ANOTHER QUESTION
   ========================================= */

if (continueButton) {

    continueButton.addEventListener(
        "click",
        askAnotherQuestion
    );

}


if (resultQuestionButton) {

    resultQuestionButton.addEventListener(
        "click",
        askAnotherQuestion
    );

}


function askAnotherQuestion() {

    if (
        selectedFiles.length === 0
    ) {

        alert(
            "Please upload imagery first."
        );

        return;

    }


    /*
       KEEP IMAGES
    */

    if (resultView) {

        resultView.classList.add(
            "visible"
        );

    }


    if (imageGallery) {

        imageGallery.classList.remove(
            "visible"
        );

    }


    if (imageSession) {

        imageSession.textContent =
            `${selectedFiles.length} image${
                selectedFiles.length > 1
                    ? "s"
                    : ""
            } retained — ask another question.`;

    }


    queryInput.focus();

}


/* =========================================
   CLEAR CHAT
   ========================================= */

if (clearChatButton) {

    clearChatButton.addEventListener(
        "click",
        clearConversation
    );

}


if (clearChatResultButton) {

    clearChatResultButton.addEventListener(
        "click",
        clearConversation
    );

}


async function clearConversation() {

    if (
        selectedFiles.length === 0
    ) {

        return;

    }


    /*
       KEEP IMAGES
    */

    questionHistory =
        [];


    /*
       REMOVE OLD MESSAGES
    */

    chatHistory.innerHTML =
        "";


    /*
       RESET STATUS
    */

    resultStatus.textContent =
        "READY";


    /*
       KEEP RESULT VIEW
    */

    resultView.classList.add(
        "visible"
    );


    /*
       HIDE GALLERY
    */

    if (imageGallery) {

        imageGallery.classList.remove(
            "visible"
        );

    }


    /*
       UPDATE SESSION
    */

    imageSession.textContent =
        `${selectedFiles.length} image${
            selectedFiles.length > 1
                ? "s"
                : ""
        } retained — new conversation ready.`;


    /*
       NEW CONVERSATION MESSAGE
    */

    const newChat =
        document.createElement(
            "div"
        );


    newChat.className =
        "chat-message ai-message";


    newChat.innerHTML = `

        <div class="message-label">
            SATQUERY AI
        </div>

        <h3>
            New Conversation
        </h3>

        <p>
            Your imagery is still loaded.
            Ask a new question to begin.
        </p>

    `;


    chatHistory.appendChild(
        newChat
    );


    /*
       CLEAR INPUT
    */

    queryInput.value =
        "";


    queryInput.focus();


    scrollChatToBottom();


    await saveChat();

}


/* =========================================
   SCROLL CHAT
   ========================================= */

function scrollChatToBottom() {

    requestAnimationFrame(
        () => {

            if (!resultView) {
                return;
            }


            resultView.scrollTo({

                top:
                    resultView.scrollHeight,

                behavior:
                    "smooth"

            });

        }
    );

}


/* =========================================
   ESCAPE HTML
   ========================================= */

function escapeHTML(text) {

    const div =
        document.createElement(
            "div"
        );


    div.textContent =
        text;


    return div.innerHTML;

}


/* =========================================
   SIDEBAR — RENDER CHAT LIST
   ========================================= */

async function renderChatList() {

    if (!chatList) {
        return;
    }


    const chats =
        await getAllChats();


    /*
       CLEAR LIST
    */

    chatList.innerHTML =
        "";


    const searchTerm =
        chatSearch
            ? chatSearch.value
                .trim()
                .toLowerCase()
            : "";


    const filteredChats =
        chats.filter(
            (chat) => {

                if (!searchTerm) {
                    return true;
                }


                return (
                    chat.title &&
                    chat.title
                        .toLowerCase()
                        .includes(
                            searchTerm
                        )
                );

            }
        );


    /*
       EMPTY
    */

    if (
        filteredChats.length === 0
    ) {

        const empty =
            document.createElement(
                "div"
            );

        empty.className =
            "chat-list-empty";


        empty.textContent =
            searchTerm
                ? "No chats found"
                : "No previous chats";


        chatList.appendChild(
            empty
        );

    }


    /*
       CHAT ITEMS
    */

    filteredChats.forEach(
        (chat) => {

            const item =
                document.createElement(
                    "div"
                );

            item.className =
                "chat-item";


            if (
                chat.id ===
                currentChatId
            ) {

                item.classList.add(
                    "active"
                );

            }


            /*
               CHAT CONTENT
            */

            const content =
                document.createElement(
                    "div"
                );

            content.className =
                "chat-item-content";


            const title =
                document.createElement(
                    "div"
                );

            title.className =
                "chat-item-title";

            title.textContent =
                chat.title ||
                "New Chat";


            const meta =
                document.createElement(
                    "div"
                );

            meta.className =
                "chat-item-meta";


            const messageCount =
                chat.messages
                    ? chat.messages.length
                    : 0;


            meta.textContent =
                `${messageCount} ${
                    messageCount === 1
                        ? "message"
                        : "messages"
                }`;


            content.appendChild(
                title
            );

            content.appendChild(
                meta
            );


            /*
               DELETE BUTTON
            */

            const deleteChatButton =
                document.createElement(
                    "button"
                );

            deleteChatButton.className =
                "chat-delete";

            deleteChatButton.type =
                "button";

            deleteChatButton.textContent =
                "×";

            deleteChatButton.title =
                "Delete chat";


            deleteChatButton.addEventListener(
                "click",
                async (event) => {

                    event.preventDefault();

                    event.stopPropagation();


                    const confirmed =
                        confirm(
                            "Delete this chat?"
                        );


                    if (!confirmed) {
                        return;
                    }


                    await deleteStoredChat(
                        chat.id
                    );


                    if (
                        chat.id ===
                        currentChatId
                    ) {

                        await startNewChat();

                    }


                    renderChatList();

                }
            );


            /*
               OPEN CHAT
            */

            item.addEventListener(
                "click",
                () => {

                    openChat(chat);

                }
            );


            item.appendChild(
                content
            );

            item.appendChild(
                deleteChatButton
            );


            chatList.appendChild(
                item
            );

        }
    );


    /*
       CHAT COUNT
    */

    if (chatCount) {

        chatCount.textContent =
            `${chats.length} ${
                chats.length === 1
                    ? "chat"
                    : "chats"
            }`;

    }

}


/* =========================================
   OPEN CHAT
   ========================================= */

async function openChat(
    chat
) {

    currentChatId =
        chat.id;


    /*
       RESTORE IMAGES
    */

    selectedFiles =
        [];


    if (
        chat.images &&
        chat.images.length > 0
    ) {

        selectedFiles =
            chat.images.map(
                (image) => {

                    return new File(
                        [image.blob],
                        image.name,
                        {
                            type:
                                image.type,

                            lastModified:
                                image.lastModified
                        }
                    );

                }
            );

    }


    /*
       RESTORE QUESTIONS
    */

    questionHistory =
        chat.messages || [];


    /*
       UPDATE UI
    */

    updateImageSession();

    renderImageGallery();


    if (chatHistory) {

        chatHistory.innerHTML =
            "";

    }


    /*
       REBUILD CHAT
    */

    questionHistory.forEach(
        (message) => {

            /*
               Old chats may not have
               files saved in the message.

               In that case use the
               stored chat images.
            */

            const restoredMessage = {

                ...message,

                files:
                    message.files &&
                    message.files.length > 0

                        ? message.files

                        : selectedFiles

            };


            addQuestionMessage(
                restoredMessage
            );


            if (
                message.answer
            ) {

                addAnswerMessage(
                    restoredMessage
                );

            }

        }
    );


    /*
       SHOW RESULT IF MESSAGES EXIST
    */

    if (
        questionHistory.length > 0
    ) {

        resultView.classList.add(
            "visible"
        );


        imageGallery.classList.remove(
            "visible"
        );


        resultStatus.textContent =
            "COMPLETE";


        if (continueButton) {

            continueButton.classList.add(
                "visible"
            );

        }


        scrollChatToBottom();

    }

    else {

        resultView.classList.remove(
            "visible"
        );

    }


    renderChatList();

}


/* =========================================
   CHAT SEARCH
   ========================================= */

if (chatSearch) {

    chatSearch.addEventListener(
        "input",
        () => {

            renderChatList();

        }
    );

}


/* =========================================
   EXPORT
   ========================================= */

if (exportButton) {

    exportButton.addEventListener(
        "click",
        (event) => {

            event.preventDefault();


            if (
                selectedFiles.length === 0
            ) {

                alert(
                    "Upload imagery before exporting."
                );

                return;

            }


            alert(
                "Export will be connected to the API."
            );

        }
    );

}


/* =========================================
   INITIALIZE
   ========================================= */

async function initializeApp() {

    try {

        await openDatabase();

        const chats =
            await getAllChats();


        /*
           If previous chats exist,
           don't automatically open one.
        */

        if (
            chats.length === 0
        ) {

            currentChatId =
                createChatId();

        }


        renderChatList();

        updateImageSession();

    }

    catch (error) {

        console.error(
            "SatQuery database error:",
            error
        );

        currentChatId =
            createChatId();

        updateImageSession();

    }

}


initializeApp();