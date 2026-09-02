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
   SIDEBAR ELEMENTS
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
   DATABASE
   ========================================= */

const DB_NAME = "SatQueryDB";
const DB_VERSION = 1;
const CHAT_STORE = "chats";


/* =========================================
   OPEN DATABASE
   ========================================= */

function openDatabase() {

    return new Promise((resolve, reject) => {

        const request =
            indexedDB.open(
                DB_NAME,
                DB_VERSION
            );


        request.onupgradeneeded = (event) => {

            const db =
                event.target.result;


            if (!db.objectStoreNames.contains(CHAT_STORE)) {

                const store =
                    db.createObjectStore(
                        CHAT_STORE,
                        {
                            keyPath: "id"
                        }
                    );


                store.createIndex(
                    "updatedAt",
                    "updatedAt"
                );

            }

        };


        request.onsuccess = () => {

            resolve(
                request.result
            );

        };


        request.onerror = () => {

            reject(
                request.error
            );

        };

    });

}


let databasePromise =
    openDatabase();


/* =========================================
   GET ONE CHAT
   ========================================= */

async function getChat(id) {

    try {

        const db =
            await databasePromise;


        return new Promise(
            (resolve, reject) => {

                const transaction =
                    db.transaction(
                        CHAT_STORE,
                        "readonly"
                    );


                const request =
                    transaction
                        .objectStore(CHAT_STORE)
                        .get(id);


                request.onsuccess =
                    () => {

                        resolve(
                            request.result || null
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
    catch (error) {

        console.error(
            "Error loading chat:",
            error
        );

        return null;

    }

}


/* =========================================
   GET ALL CHATS
   ========================================= */

async function getAllChats() {

    try {

        const db =
            await databasePromise;


        return new Promise(
            (resolve, reject) => {

                const transaction =
                    db.transaction(
                        CHAT_STORE,
                        "readonly"
                    );


                const request =
                    transaction
                        .objectStore(CHAT_STORE)
                        .getAll();


                request.onsuccess =
                    () => {

                        const chats =
                            request.result || [];


                        chats.sort(
                            (a, b) =>
                                b.updatedAt -
                                a.updatedAt
                        );


                        resolve(
                            chats
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
    catch (error) {

        console.error(
            "Error loading chats:",
            error
        );

        return [];

    }

}


/* =========================================
   SAVE CURRENT CHAT
   ========================================= */

async function saveChat() {

    if (!currentChatId) {

        return;

    }


    try {

        const db =
            await databasePromise;


        const existingChat =
            await getChat(
                currentChatId
            );


        const chatData = {

            id:
                currentChatId,

            title:
                getChatTitle(),

            createdAt:
                existingChat?.createdAt ||
                Date.now(),

            updatedAt:
                Date.now(),

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


        return new Promise(
            (resolve, reject) => {

                const transaction =
                    db.transaction(
                        CHAT_STORE,
                        "readwrite"
                    );


                transaction
                    .objectStore(CHAT_STORE)
                    .put(chatData);


                transaction.oncomplete =
                    async () => {

                        await renderChatList();

                        resolve();

                    };


                transaction.onerror =
                    () => {

                        reject(
                            transaction.error
                        );

                    };

            }
        );

    }
    catch (error) {

        console.error(
            "Could not save chat:",
            error
        );

    }

}


/* =========================================
   DELETE STORED CHAT
   ========================================= */

async function deleteStoredChat(id) {

    try {

        const db =
            await databasePromise;


        return new Promise(
            (resolve, reject) => {

                const transaction =
                    db.transaction(
                        CHAT_STORE,
                        "readwrite"
                    );


                transaction
                    .objectStore(CHAT_STORE)
                    .delete(id);


                transaction.oncomplete =
                    () => {

                        resolve();

                    };


                transaction.onerror =
                    () => {

                        reject(
                            transaction.error
                        );

                    };

            }
        );

    }
    catch (error) {

        console.error(
            "Could not delete chat:",
            error
        );

    }

}


/* =========================================
   CREATE CHAT ID
   ========================================= */

function createChatId() {

    return (
        Date.now().toString(36) +
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
        questionHistory.length > 0
    ) {

        return questionHistory[0].question;

    }


    if (
        selectedFiles.length === 1
    ) {

        return selectedFiles[0].name;

    }


    if (
        selectedFiles.length > 1
    ) {

        return `${selectedFiles.length} Images`;

    }


    return "New Chat";

}


/* =========================================
   NEW CHAT
   ========================================= */

function startNewChat() {

    currentChatId =
        createChatId();


    selectedFiles =
        [];

    questionHistory =
        [];

    analysisRunning =
        false;


    if (imageInput) {

        imageInput.value =
            "";

    }


    imageGallery.innerHTML =
        "";

    imageGallery.className =
        "image-gallery";


    chatHistory.innerHTML =
        "";


    resultView.classList.remove(
        "visible"
    );


    emptyState.style.display =
        "block";


    deleteButton.classList.remove(
        "visible"
    );


    clearChatButton.classList.remove(
        "visible"
    );


    continueButton.classList.remove(
        "visible"
    );


    fileName.textContent =
        "";


    imageSession.textContent =
        "No imagery loaded.";

    imageSession.classList.remove(
        "active"
    );


    resultStatus.textContent =
        "READY";


    selectedAnalysis =
        "NDVI";


    analysisOptions.forEach(
        (option) => {

            option.classList.remove(
                "active"
            );

        }
    );


    const ndvi =
        document.querySelector(
            '[data-analysis="NDVI"]'
        );


    if (ndvi) {

        ndvi.classList.add(
            "active"
        );

    }


    updateSidebarActiveState();


    queryInput.value =
        "";


    queryInput.focus();

}


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
               Create chat automatically
               when user uploads to a
               blank/new chat.
            */

            if (!currentChatId) {

                currentChatId =
                    createChatId();

            }


            /*
               IMPORTANT:
               APPEND new images.

               Existing images are NOT
               removed and existing
               questions are NOT cleared.
            */

            files.forEach(
                (file) => {

                    const exists =
                        selectedFiles.some(
                            (existingFile) =>

                                existingFile.name ===
                                    file.name &&

                                existingFile.size ===
                                    file.size &&

                                existingFile.lastModified ===
                                    file.lastModified
                        );


                    if (!exists) {

                        selectedFiles.push(
                            file
                        );

                    }

                }
            );


            /*
               Reset input.

               This allows the user to
               select the same file again
               later if required.
            */

            imageInput.value =
                "";


            /*
               Update image display.
            */

            renderImageGallery();

            updateImageSession();


            /*
               IMPORTANT:

               When the user uploads new
               images after asking previous
               questions, switch back to
               the image view.

               Previous questions remain
               saved in questionHistory.
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
               Save everything.

               This means the old questions
               AND the newly uploaded images
               stay inside the same chat.
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
       1 IMAGE
    */

    if (
        selectedFiles.length === 1
    ) {

        imageGallery.classList.add(
            "single"
        );

    }


    /*
       2 IMAGES
    */

    else if (
        selectedFiles.length === 2
    ) {

        imageGallery.classList.add(
            "double"
        );

    }


    /*
       3 IMAGES
    */

    else if (
        selectedFiles.length === 3
    ) {

        imageGallery.classList.add(
            "triple"
        );

    }


    /*
       4+ IMAGES
    */

    else {

        imageGallery.classList.add(
            "multi"
        );

    }


    /*
       CREATE CARDS
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


            img.onload =
                () => {

                    URL.revokeObjectURL(
                        objectURL
                    );

                };


            /*
               NUMBER
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
               REMOVE
            */

            const removeButton =
                document.createElement(
                    "button"
                );


            removeButton.className =
                "remove-image";


            removeButton.type =
                "button";


            removeButton.textContent =
                "×";


            removeButton.setAttribute(
                "aria-label",
                `Remove image ${index + 1}`
            );


            removeButton.addEventListener(
                "click",
                async (event) => {

                    event.preventDefault();

                    event.stopPropagation();

                    await removeImage(
                        index
                    );

                }
            );


            /*
               BUILD
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
       If no images remain,
       close result view.
    */

    if (
        selectedFiles.length === 0
    ) {

        resultView.classList.remove(
            "visible"
        );

        continueButton.classList.remove(
            "visible"
        );

    }


    await saveChat();

}


/* =========================================
   UPDATE IMAGE SESSION
   ========================================= */

function updateImageSession() {

    const count =
        selectedFiles.length;


    if (
        count === 0
    ) {

        fileName.textContent =
            "";


        imageSession.textContent =
            "No imagery loaded.";


        imageSession.classList.remove(
            "active"
        );


        deleteButton.classList.remove(
            "visible"
        );


        clearChatButton.classList.remove(
            "visible"
        );


        emptyState.style.display =
            "block";


        return;

    }


    emptyState.style.display =
        "none";


    deleteButton.classList.add(
        "visible"
    );


    clearChatButton.classList.add(
        "visible"
    );


    if (
        count === 1
    ) {

        fileName.textContent =
            selectedFiles[0].name;


        imageSession.textContent =
            "1 image loaded — ready for questions.";

    }
    else {

        fileName.textContent =
            `${count} images selected`;


        imageSession.textContent =
            `${count} images loaded — ready for analysis.`;

    }


    imageSession.classList.add(
        "active"
    );

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


            imageInput.value =
                "";


            imageGallery.innerHTML =
                "";

            imageGallery.className =
                "image-gallery";


            resultView.classList.remove(
                "visible"
            );


            updateImageSession();


            /*
               IMPORTANT:

               This removes images only.

               The conversation stays saved.
            */

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
        runAnalysis
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

    if (analysisRunning) {

        return;

    }


    if (
        selectedFiles.length === 0
    ) {

        alert(
            "Please upload at least one satellite image first."
        );

        return;

    }


    const query =
        queryInput.value.trim();


    if (!query) {

        alert(
            "Please enter a question first."
        );

        queryInput.focus();

        return;

    }


    if (!currentChatId) {

        currentChatId =
            createChatId();

    }


    analysisRunning =
        true;


    /*
       Save this question.
    */

    const conversation = {

        id:
            createChatId(),

        question:
            query,

        analysis:
            selectedAnalysis,

        imageCount:
            selectedFiles.length,

        timestamp:
            Date.now(),

        answer:
            null

    };


    questionHistory.push(
        conversation
    );


    /*
       UI
    */

    runButton.disabled =
        true;


    runButtonText.textContent =
        "Analyzing...";


    loadingCircle.classList.add(
        "loading"
    );


    imageGallery.classList.remove(
        "visible"
    );


    resultView.classList.add(
        "visible"
    );


    resultStatus.textContent =
        "PROCESSING";


    /*
       Question
    */

    addQuestionMessage(
        conversation
    );


    /*
       Loading
    */

    const loadingMessage =
        addLoadingMessage(
            conversation
        );


    scrollChatToBottom();


    /*
       Save question immediately.
    */

    await saveChat();


    /*
       TEMPORARY API SIMULATION
    */

    setTimeout(
        async () => {

            if (loadingMessage) {

                loadingMessage.remove();

            }


            /*
               Temporary response.
            */

            conversation.answer =
                `Analysis completed for "${conversation.question}". ` +
                `The real SatQuery API response will appear here.`;


            addAnswerMessage(
                conversation
            );


            /*
               Save answer.
            */

            await saveChat();


            resultStatus.textContent =
                "COMPLETE";


            runButton.disabled =
                false;


            runButtonText.textContent =
                "Run Analysis";


            loadingCircle.classList.remove(
                "loading"
            );


            analysisRunning =
                false;


            continueButton.classList.add(
                "visible"
            );


            queryInput.value =
                "";


            queryInput.focus();


            scrollChatToBottom();

        },
        1800
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


    message.dataset.messageId =
        data.id;


    message.innerHTML = `

        <div class="message-label">
            YOU
        </div>

        <div class="message-question">
            ${escapeHTML(data.question)}
        </div>

        <div class="message-analysis">
            ${escapeHTML(data.analysis)}
            ·
            ${data.imageCount}
            image${data.imageCount > 1 ? "s" : ""}
        </div>

    `;


    chatHistory.appendChild(
        message
    );


    return message;

}


/* =========================================
   ADD LOADING MESSAGE
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


    message.dataset.messageId =
        data.id;


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
                "Analysis result will appear here."
            )}
        </p>

    `;


    chatHistory.appendChild(
        message
    );


    return message;

}


/* =========================================
   OPEN OLD CHAT
   ========================================= */

async function openChat(
    chat
) {

    if (!chat) {

        return;

    }


    currentChatId =
        chat.id;


    questionHistory =
        chat.messages || [];


    selectedFiles =
        (chat.images || []).map(
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


    /*
       Rebuild images.
    */

    renderImageGallery();

    updateImageSession();


    /*
       Rebuild chat.
    */

    chatHistory.innerHTML =
        "";


    questionHistory.forEach(
        (conversation) => {

            addQuestionMessage(
                conversation
            );


            if (
                conversation.answer
            ) {

                addAnswerMessage(
                    conversation
                );

            }

        }
    );


    /*
       Existing conversation
       opens directly in chat mode.
    */

    if (
        questionHistory.length > 0
    ) {

        imageGallery.classList.remove(
            "visible"
        );


        resultView.classList.add(
            "visible"
        );


        continueButton.classList.add(
            "visible"
        );


        resultStatus.textContent =
            "SAVED";

    }


    /*
       Image-only chat.
    */

    else if (
        selectedFiles.length > 0
    ) {

        resultView.classList.remove(
            "visible"
        );


        imageGallery.classList.add(
            "visible"
        );

    }


    /*
       Empty chat.
    */

    else {

        resultView.classList.remove(
            "visible"
        );

    }


    updateSidebarActiveState();


    queryInput.value =
        "";


    queryInput.focus();


    scrollChatToBottom();

}


/* =========================================
   RENDER SIDEBAR
   ========================================= */

async function renderChatList() {

    if (!chatList) {

        return;

    }


    let chats =
        await getAllChats();


    const search =
        chatSearch
            ? chatSearch.value
                .trim()
                .toLowerCase()
            : "";


    if (search) {

        chats =
            chats.filter(
                (chat) =>
                    chat.title
                        .toLowerCase()
                        .includes(search)
            );

    }


    chatList.innerHTML =
        "";


    if (
        chats.length === 0
    ) {

        const empty =
            document.createElement(
                "div"
            );


        empty.className =
            "chat-list-empty";


        empty.textContent =
            search
                ? "No chats found"
                : "No previous chats";


        chatList.appendChild(
            empty
        );


        if (chatCount) {

            chatCount.textContent =
                "0 chats";

        }


        return;

    }


    chats.forEach(
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
                chat.title;


            const meta =
                document.createElement(
                    "div"
                );


            meta.className =
                "chat-item-meta";


            meta.textContent =
                `${chat.messages.length} message${
                    chat.messages.length !== 1
                        ? "s"
                        : ""
                }`;


            content.appendChild(
                title
            );

            content.appendChild(
                meta
            );


            const deleteChatButton =
                document.createElement(
                    "button"
                );


            deleteChatButton.className =
                "chat-delete-button";


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

                        startNewChat();

                    }


                    await renderChatList();

                }
            );


            item.addEventListener(
                "click",
                async () => {

                    await openChat(
                        chat
                    );

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


    if (chatCount) {

        chatCount.textContent =
            `${chats.length} chat${
                chats.length !== 1
                    ? "s"
                    : ""
            }`;

    }

}


/* =========================================
   UPDATE SIDEBAR
   ========================================= */

async function updateSidebarActiveState() {

    await renderChatList();

}


/* =========================================
   SEARCH
   ========================================= */

if (chatSearch) {

    chatSearch.addEventListener(
        "input",
        renderChatList
    );

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
       Keep all existing images.
    */

    resultView.classList.add(
        "visible"
    );


    imageGallery.classList.remove(
        "visible"
    );


    imageSession.textContent =
        `${selectedFiles.length} image${
            selectedFiles.length > 1
                ? "s"
                : ""
        } retained — ask another question.`;


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
        !currentChatId
    ) {

        return;

    }


    const confirmed =
        confirm(
            "Clear this conversation? Your images will remain."
        );


    if (!confirmed) {

        return;

    }


    /*
       Keep images.
    */

    questionHistory =
        [];


    chatHistory.innerHTML =
        "";


    resultStatus.textContent =
        "READY";


    resultView.classList.add(
        "visible"
    );


    imageGallery.classList.remove(
        "visible"
    );


    continueButton.classList.remove(
        "visible"
    );


    imageSession.textContent =
        `${selectedFiles.length} image${
            selectedFiles.length > 1
                ? "s"
                : ""
        } retained — new conversation ready.`;


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


    queryInput.value =
        "";


    await saveChat();


    queryInput.focus();


    scrollChatToBottom();

}


/* =========================================
   SCROLL
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

(async function initialize() {

    try {

        await databasePromise;

        await renderChatList();


        currentChatId =
            null;

    }
    catch (error) {

        console.error(
            "SatQuery initialization failed:",
            error
        );

    }

})();