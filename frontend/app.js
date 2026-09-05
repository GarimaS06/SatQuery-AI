/* =========================================
   SATQUERY AI — APPLICATION LOGIC
   PREPROCESSING + ROUTER INTEGRATION
   ========================================= */


/* =========================================
   API CONFIGURATION
   ========================================= */

const PREPROCESS_URL =
    "http://localhost:4000/api/preprocess";

const ROUTER_URL =
    "http://localhost:8000/api/router/analyze";


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

let questionHistory = [];

let analysisRunning = false;

let currentChatId = null;


/* =========================================
   INDEXEDDB
   ========================================= */

const DB_NAME =
    "SatQueryDB";

const DB_VERSION =
    1;

const STORE_NAME =
    "chats";


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

            if (
                selectedFiles.length >= 2
            ) {

                alert(
                    "SatQuery allows a maximum of 2 images."
                );

                return;

            }


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


            const remainingSlots =
                2 - selectedFiles.length;


            if (
                remainingSlots <= 0
            ) {

                alert(
                    "SatQuery allows a maximum of 2 images."
                );

                imageInput.value =
                    "";

                return;

            }


            const filesToAdd =
                files.slice(
                    0,
                    remainingSlots
                );


            if (
                files.length >
                remainingSlots
            ) {

                alert(
                    "Only 2 images are allowed."
                );

            }


            if (!currentChatId) {

                currentChatId =
                    createChatId();

            }


            filesToAdd.forEach(
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
                        !alreadyExists &&
                        selectedFiles.length < 2
                    ) {

                        selectedFiles.push(
                            file
                        );

                    }

                }
            );


            imageInput.value =
                "";


            renderImageGallery();

            updateImageSession();


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


    if (
        selectedFiles.length === 1
    ) {

        imageGallery.classList.add(
            "single"
        );

    }

    else {

        imageGallery.classList.add(
            "double"
        );

    }


    selectedFiles.forEach(
        (file, index) => {

            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "image-card";


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


            const number =
                document.createElement(
                    "div"
                );


            number.className =
                "image-number";


            number.textContent =
                `IMAGE ${index + 1}`;


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


            removeButton.addEventListener(
                "click",
                (event) => {

                    event.preventDefault();

                    event.stopPropagation();

                    removeImage(index);

                }
            );


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


    if (fileName) {

        if (count === 1) {

            fileName.textContent =
                selectedFiles[0].name;

        }

        else {

            fileName.textContent =
                "2 images selected";

        }

    }


    if (imageSession) {

        if (count === 1) {

            imageSession.textContent =
                "1 image loaded — ready for questions.";

        }

        else {

            imageSession.textContent =
                "2 images loaded — ready for comparison.";

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
   OLD ANALYSIS OPTIONS
   (buttons removed from the UI —
   analysis type is now decided entirely
   by the router from the question text)
   ========================================= */


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
   PREPROCESS IMAGES
   ========================================= */

async function preprocessImages(
    question
) {

    if (
        selectedFiles.length === 0
    ) {

        throw new Error(
            "No image selected."
        );

    }


    const formData =
        new FormData();


    /*
       FIRST IMAGE
    */

    formData.append(
        "image",
        selectedFiles[0]
    );


    /*
       SECOND IMAGE
       OPTIONAL
    */

    if (
        selectedFiles.length === 2
    ) {

        formData.append(
            "image2",
            selectedFiles[1]
        );

    }


    /*
       QUESTION
    */

    formData.append(
        "question",
        question
    );


    console.log(
        "→ Sending images to preprocessing..."
    );


    const response =
        await fetch(
            PREPROCESS_URL,
            {
                method: "POST",
                body: formData
            }
        );


    let data;


    try {

        data =
            await response.json();

    }

    catch (error) {

        throw new Error(
            `Preprocessing returned invalid JSON. HTTP ${response.status}`
        );

    }


    console.log(
        "← Preprocessing response:",
        data
    );


    if (!response.ok) {

        throw new Error(
            data?.error ||
            data?.message ||
            `Preprocessing failed with HTTP ${response.status}`
        );

    }


    if (
        !data.processedImage
    ) {

        throw new Error(
            "Preprocessing response does not contain processedImage."
        );

    }


    if (
        selectedFiles.length === 2 &&
        !data.processedImage2
    ) {

        throw new Error(
            "Second image was uploaded, but preprocessing did not return processedImage2."
        );

    }


    return data;

}


/* =========================================
   ROUTER REQUEST
   ========================================= */

async function callRouter(
    question
) {

    /*
       FIRST:
       preprocess the images
    */

    const preprocessingResponse =
        await preprocessImages(
            question
        );


    /*
       BUILD ROUTER JSON

       Single image:
       {
           question,
           image
       }

       Two images:
       {
           question,
           image,
           image2
       }
    */

    const requestBody = {

        question:
            question,

        image:
            preprocessingResponse.processedImage

    };


    if (
        selectedFiles.length === 2
    ) {

        requestBody.image2 =
            preprocessingResponse.processedImage2;

    }


    console.log(
        "→ Sending request to Router:",
        requestBody
    );


    /*
       ROUTER REQUEST IS JSON
    */

    const response =
        await fetch(
            ROUTER_URL,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body:
                    JSON.stringify(
                        requestBody
                    )

            }
        );


    let data;


    try {

        data =
            await response.json();

    }

    catch (error) {

        throw new Error(
            `Router returned invalid JSON. HTTP ${response.status}`
        );

    }


    console.log(
        "← Router response:",
        data
    );


    if (!response.ok) {

        throw new Error(
            data?.answer ||
            data?.error ||
            data?.message ||
            `Router failed with HTTP ${response.status}`
        );

    }


    return data;

}


/* =========================================
   RUN ANALYSIS
   ========================================= */

async function runAnalysis() {

    if (analysisRunning) {
        return;
    }


    /*
       IMAGE CHECK
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
       MAX 2
    */

    if (
        selectedFiles.length > 2
    ) {

        alert(
            "SatQuery allows a maximum of 2 images."
        );

        return;

    }


    /*
       QUESTION CHECK
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
       CREATE CHAT
    */

    if (!currentChatId) {

        currentChatId =
            createChatId();

    }


    analysisRunning =
        true;


    /*
       SAVE QUESTION
    */

    const conversation = {

        question:
            query,

        imageCount:
            selectedFiles.length,

        files:
            [...selectedFiles],

        timestamp:
            new Date(),

        answer:
            null,

        status:
            "processing",

        confidence:
            null,

        tasks:
            [],

        tools_used:
            [],

        results:
            [],

        errors:
            [],

        routerResponse:
            null

    };


    questionHistory.push(
        conversation
    );


    /*
       UI — LOADING
    */

    setAnalysisLoading(
        true
    );


    if (imageGallery) {

        imageGallery.classList.remove(
            "visible"
        );

    }


    if (resultView) {

        resultView.classList.add(
            "visible"
        );

    }


    setResultStatus(
        "PROCESSING"
    );


    /*
       SHOW USER QUESTION
    */

    addQuestionMessage(
        conversation
    );


    /*
       SHOW LOADING
    */

    const loadingMessage =
        addLoadingMessage(
            conversation
        );


    scrollChatToBottom();


    await saveChat();


    try {

        /*
           REAL:
           PREPROCESS → ROUTER
        */

        const routerResponse =
            await callRouter(
                query
            );


        /*
           STORE RESPONSE
        */

        conversation.routerResponse =
            routerResponse;


        conversation.answer =
            routerResponse.answer ||
            "";


        conversation.status =
            routerResponse.status ||
            "success";


        conversation.confidence =
            routerResponse.confidence;


        conversation.tasks =
            routerResponse.tasks ||
            [];


        conversation.tools_used =
            routerResponse.tools_used ||
            [];


        conversation.results =
            routerResponse.results ||
            [];


        conversation.errors =
            routerResponse.errors ||
            [];


        /*
           REMOVE LOADING
        */

        if (loadingMessage) {

            loadingMessage.remove();

        }


        /*
           SHOW RESULT
        */

        addAnswerMessage(
            conversation
        );


        /*
           RESULT STATE
        */

        const status =
            String(
                conversation.status
            ).toLowerCase();


        if (
            status === "failed" ||
            status === "error"
        ) {

            setResultStatus(
                "FAILED"
            );

        }

        else if (
            status === "partial"
        ) {

            setResultStatus(
                "PARTIAL"
            );

        }

        else {

            setResultStatus(
                "COMPLETE"
            );

        }

    }

    catch (error) {

        console.error(
            "SatQuery analysis error:",
            error
        );


        conversation.status =
            "failed";


        conversation.answer =
            error.message ||
            "Unable to complete analysis.";


        conversation.errors =
            [
                error.message ||
                "Unknown error"
            ];


        if (loadingMessage) {

            loadingMessage.remove();

        }


        addErrorMessage(
            conversation
        );


        setResultStatus(
            "ERROR"
        );

    }


    /*
       FINISH LOADING
    */

    setAnalysisLoading(
        false
    );


    analysisRunning =
        false;


    /*
       SAVE CHAT
    */

    await saveChat();


    /*
       ENABLE NEXT QUESTION
    */

    if (continueButton) {

        continueButton.classList.add(
            "visible"
        );

    }


    /*
       CLEAR QUESTION INPUT
    */

    queryInput.value =
        "";


    queryInput.focus();


    scrollChatToBottom();

}


/* =========================================
   LOADING UI
   ========================================= */

function setAnalysisLoading(
    loading
) {

    if (runButton) {

        runButton.disabled =
            loading;

    }


    if (runButtonText) {

        runButtonText.textContent =
            loading
                ? "Analyzing..."
                : "Run Analysis";

    }


    if (loadingCircle) {

        if (loading) {

            loadingCircle.classList.add(
                "loading"
            );

        }

        else {

            loadingCircle.classList.remove(
                "loading"
            );

        }

    }

}


/* =========================================
   RESULT STATUS
   ========================================= */

function setResultStatus(
    status
) {

    if (!resultStatus) {
        return;
    }


    resultStatus.textContent =
        status;

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


    const imagePreview =
        document.createElement(
            "div"
        );


    imagePreview.className =
        "question-image-preview";


    /*
       SHOW THE ACTUAL IMAGE(S)
       USED BY THIS QUESTION
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
            ${data.imageCount}
            image${data.imageCount > 1 ? "s" : ""}
            · Router decides analysis
        </div>

    `;


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
            and routing your question
            to the appropriate analysis.
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


    const response =
        data.routerResponse ||
        {};


    const status =
        String(
            data.status ||
            response.status ||
            "success"
        ).toLowerCase();


    let statusLabel =
        "SUCCESS";


    if (
        status === "partial"
    ) {

        statusLabel =
            "PARTIAL";

    }

    else if (
        status === "failed" ||
        status === "error"
    ) {

        statusLabel =
            "FAILED";

    }


    let confidenceHTML =
        "";


    if (
        data.confidence !== null &&
        data.confidence !== undefined
    ) {

        const confidenceValue =
            Number(
                data.confidence
            );


        const confidenceDisplay =
            confidenceValue <= 1
                ? confidenceValue * 100
                : confidenceValue;


        confidenceHTML = `

            <span>
                CONFIDENCE:
                ${escapeHTML(
                    confidenceDisplay
                        .toFixed(1)
                )}%
            </span>

        `;

    }


    const tasks =
        Array.isArray(data.tasks)
            ? data.tasks
            : [];


    const tools =
        Array.isArray(data.tools_used)
            ? data.tools_used
            : [];


    message.innerHTML = `

        <div class="message-label">
            SATQUERY AI
        </div>

        <h3>
            Analysis Result
        </h3>

        <div class="router-answer">
            ${escapeHTML(
                data.answer ||
                "No answer returned by Router."
            )}
        </div>

        <div class="router-meta">

            <span>
                STATUS:
                ${escapeHTML(
                    statusLabel
                )}
            </span>

            ${confidenceHTML}

        </div>

        ${
            tasks.length > 0
                ? `
                    <div class="router-detail">

                        <strong>
                            Tasks
                        </strong>

                        <div>
                            ${escapeHTML(
                                tasks.join(", ")
                            )}
                        </div>

                    </div>
                  `
                : ""
        }

        ${
            tools.length > 0
                ? `
                    <div class="router-detail">

                        <strong>
                            Tools Used
                        </strong>

                        <div>
                            ${escapeHTML(
                                tools.join(", ")
                            )}
                        </div>

                    </div>
                  `
                : ""
        }

    `;


    /*
       DETAILED RESULTS
    */

    if (
        Array.isArray(data.results) &&
        data.results.length > 0
    ) {

        const resultsContainer =
            document.createElement(
                "div"
            );


        resultsContainer.className =
            "router-results";


        const title =
            document.createElement(
                "div"
            );


        title.className =
            "router-detail-title";


        title.textContent =
            "ANALYSIS DETAILS";


        resultsContainer.appendChild(
            title
        );


        data.results.forEach(
            (result) => {

                const resultCard =
                    document.createElement(
                        "div"
                    );


                resultCard.className =
                    "router-result-card";


                const tool =
                    result.tool ||
                    "analysis";


                let html = `

                    <div class="router-result-tool">
                        ${escapeHTML(
                            String(
                                tool
                            ).toUpperCase()
                        )}
                    </div>

                `;


                if (
                    result.output
                ) {

                    const output =
                        result.output;


                    const analysisType =
                        output.analysis_type ||
                        tool;


                    html += `

                        <div class="router-detail">

                            <strong>
                                Type
                            </strong>

                            <div>
                                ${escapeHTML(
                                    String(
                                        analysisType
                                    )
                                )}
                            </div>

                        </div>

                    `;


                    if (
                        output.result
                    ) {

                        html +=
                            buildResultHTML(
                                output.result
                            );

                    }

                }


                /*
                   OUTPUT FILES
                */

                if (
                    result.output_files
                ) {

                    html += `

                        <div class="router-detail">

                            <strong>
                                Output Files
                            </strong>

                            <div>
                                ${escapeHTML(
                                    JSON.stringify(
                                        result.output_files
                                    )
                                )}
                            </div>

                        </div>

                    `;

                }


                /*
                   WARNINGS
                */

                if (
                    Array.isArray(
                        result.warnings
                    ) &&
                    result.warnings.length > 0
                ) {

                    html += `

                        <div class="router-warning">

                            <strong>
                                Warnings
                            </strong>

                            <div>
                                ${escapeHTML(
                                    result.warnings.join(
                                        ", "
                                    )
                                )}
                            </div>

                        </div>

                    `;

                }


                /*
                   ERROR
                */

                if (
                    result.error
                ) {

                    html += `

                        <div class="router-error">

                            ${escapeHTML(
                                String(
                                    result.error
                                )
                            )}

                        </div>

                    `;

                }


                resultCard.innerHTML =
                    html;


                if (
                    result.success === false
                ) {

                    resultCard.classList.add(
                        "failed"
                    );

                }


                resultsContainer.appendChild(
                    resultCard
                );

            }
        );


        message.appendChild(
            resultsContainer
        );

    }


    /*
       TOP-LEVEL ERRORS
    */

    if (
        Array.isArray(data.errors) &&
        data.errors.length > 0
    ) {

        const errors =
            document.createElement(
                "div"
            );


        errors.className =
            "router-error";


        errors.innerHTML = `

            <strong>
                Errors
            </strong>

            <div>
                ${escapeHTML(
                    data.errors.join(
                        " | "
                    )
                )}
            </div>

        `;


        message.appendChild(
            errors
        );

    }


    chatHistory.appendChild(
        message
    );


    return message;

}


/* =========================================
   BUILD RESULT HTML
   ========================================= */

function buildResultHTML(
    result
) {

    if (
        result === null ||
        result === undefined
    ) {

        return "";

    }


    if (
        typeof result !== "object"
    ) {

        return `

            <div class="router-detail">

                <strong>
                    Result
                </strong>

                <div>
                    ${escapeHTML(
                        String(
                            result
                        )
                    )}
                </div>

            </div>

        `;

    }


    let html =
        "";


    Object.entries(
        result
    ).forEach(
        ([key, value]) => {

            let displayValue;


            if (
                typeof value === "object"
            ) {

                displayValue =
                    JSON.stringify(
                        value
                    );

            }

            else {

                displayValue =
                    String(value);

            }


            html += `

                <div class="router-detail">

                    <strong>
                        ${escapeHTML(
                            formatKey(key)
                        )}
                    </strong>

                    <div>
                        ${escapeHTML(
                            displayValue
                        )}
                    </div>

                </div>

            `;

        }
    );


    return html;

}


/* =========================================
   FORMAT RESULT KEY
   ========================================= */

function formatKey(
    key
) {

    return String(key)
        .replace(
            /_/g,
            " "
        )
        .replace(
            /\b\w/g,
            (letter) =>
                letter.toUpperCase()
        );

}


/* =========================================
   ERROR MESSAGE
   ========================================= */

function addErrorMessage(
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
            Analysis Failed
        </h3>

        <p class="router-error">
            ${escapeHTML(
                data.answer ||
                "Something went wrong while processing the request."
            )}
        </p>

        ${
            data.errors &&
            data.errors.length > 0
                ? `
                    <div class="router-detail">

                        <strong>
                            Error Details
                        </strong>

                        <div>
                            ${escapeHTML(
                                data.errors.join(
                                    " | "
                                )
                            )}
                        </div>

                    </div>
                  `
                : ""
        }

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


    questionHistory =
        [];


    chatHistory.innerHTML =
        "";


    resultStatus.textContent =
        "READY";


    resultView.classList.add(
        "visible"
    );


    if (imageGallery) {

        imageGallery.classList.remove(
            "visible"
        );

    }


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


    selectedFiles =
        [];


    if (
        chat.images &&
        chat.images.length > 0
    ) {

        selectedFiles =
            chat.images
                .slice(0, 2)
                .map(
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


    questionHistory =
        chat.messages || [];


    updateImageSession();

    renderImageGallery();


    if (chatHistory) {

        chatHistory.innerHTML =
            "";

    }


    questionHistory.forEach(
        (message) => {

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
                message.answer ||
                message.routerResponse
            ) {

                addAnswerMessage(
                    restoredMessage
                );

            }

        }
    );


    if (
        questionHistory.length > 0
    ) {

        resultView.classList.add(
            "visible"
        );


        imageGallery.classList.remove(
            "visible"
        );


        const lastMessage =
            questionHistory[
                questionHistory.length - 1
            ];


        const lastStatus =
            String(
                lastMessage.status ||
                "success"
            ).toLowerCase();


        if (
            lastStatus === "failed"
        ) {

            resultStatus.textContent =
                "ERROR";

        }

        else if (
            lastStatus === "partial"
        ) {

            resultStatus.textContent =
                "PARTIAL";

        }

        else {

            resultStatus.textContent =
                "COMPLETE";

        }


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