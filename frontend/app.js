/* =========================================
   SATQUERY AI — APPLICATION LOGIC
   PREPROCESSING + ROUTER INTEGRATION
   ========================================= */


/* =========================================
   PAGE LOADER
   Hide the spinner carried over from the
   landing page, once this page has actually
   painted — with a short minimum display
   time so it never just flickers.
   ========================================= */

(function hidePageLoader() {

    const pageLoader =
        document.getElementById(
            "pageLoader"
        );


    if (!pageLoader) {

        return;

    }


    const minimumDisplayMs = 550;


    window.addEventListener(
        "load",
        () => {

            setTimeout(() => {

                pageLoader.classList.add(
                    "hidden"
                );

            }, minimumDisplayMs);

        }
    );

})();


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
   TIFF PREVIEW GENERATOR (UI ONLY)
   Decodes uncompressed 8/16/32-bit TIFF to canvas PNG data URL
   Does NOT alter the original file sent to backend
   ========================================= */

const tiffPreviewCache = new WeakMap();

async function getTiffPreviewURL(file) {
    if (!file) return null;
    if (file._previewUrl) return file._previewUrl;
    if (tiffPreviewCache.has(file)) return tiffPreviewCache.get(file);

    try {
        const buffer = await file.arrayBuffer();
        const dataUrl = renderTiffBufferToDataURL(buffer);
        if (dataUrl) {
            file._previewUrl = dataUrl;
            tiffPreviewCache.set(file, dataUrl);
            return dataUrl;
        }
    } catch (err) {
        console.warn("Could not generate TIFF preview:", err);
    }
    return null;
}

function renderTiffBufferToDataURL(buffer) {
    if (!buffer || buffer.byteLength < 8) return null;
    const view = new DataView(buffer);
    const byteOrder = view.getUint16(0);
    let isLE;
    if (byteOrder === 0x4949) isLE = true;
    else if (byteOrder === 0x4D4D) isLE = false;
    else return null;

    if (view.getUint16(2, isLE) !== 42) return null;

    const ifdOffset = view.getUint32(4, isLE);
    if (ifdOffset >= buffer.byteLength) return null;

    const numEntries = view.getUint16(ifdOffset, isLE);
    const tags = {};
    for (let i = 0; i < numEntries; i++) {
        const o = ifdOffset + 2 + i * 12;
        if (o + 12 > buffer.byteLength) break;
        const tag = view.getUint16(o, isLE);
        const type = view.getUint16(o + 2, isLE);
        const count = view.getUint32(o + 4, isLE);
        const valOffset = (count === 1 && (type === 1 || type === 3 || type === 4)) ? (o + 8) : view.getUint32(o + 8, isLE);
        tags[tag] = { type, count, valOffset };
    }

    const readVal = (tag, defaultVal = 0) => {
        if (!tags[tag]) return defaultVal;
        const { type, count, valOffset } = tags[tag];
        if (type === 3) return view.getUint16(valOffset, isLE);
        if (type === 4) return view.getUint32(valOffset, isLE);
        if (type === 1) return view.getUint8(valOffset);
        return valOffset;
    };

    const width = readVal(256);
    const height = readVal(257);
    if (!width || !height || width > 10000 || height > 10000) return null;

    const samples = readVal(277, 1);
    const bps = readVal(258, 8);
    const format = readVal(339, 1);
    const compression = readVal(259, 1);
    const rowsPerStrip = readVal(278, height);

    if (compression !== 1) return null;

    const stripOffsetsTag = tags[273];
    if (!stripOffsetsTag) return null;
    const stripCount = stripOffsetsTag.count;
    const stripOffsets = [];
    for (let i = 0; i < stripCount; i++) {
        const o = stripOffsetsTag.type === 4
            ? view.getUint32(stripOffsetsTag.valOffset + i * 4, isLE)
            : view.getUint16(stripOffsetsTag.valOffset + i * 2, isLE);
        stripOffsets.push(o);
    }

    const totalPixels = width * height;
    const rVals = new Float32Array(totalPixels);
    const gVals = new Float32Array(totalPixels);
    const bVals = new Float32Array(totalPixels);

    let minV = Infinity;
    let maxV = -Infinity;
    let pixelIdx = 0;
    const bytesPerSample = Math.max(1, Math.floor(bps / 8));

    for (let stripIdx = 0; stripIdx < stripCount; stripIdx++) {
        const offset = stripOffsets[stripIdx];
        const rowsInThisStrip = Math.min(rowsPerStrip, height - stripIdx * rowsPerStrip);
        const pixelsInStrip = rowsInThisStrip * width;

        for (let p = 0; p < pixelsInStrip && pixelIdx < totalPixels; p++) {
            const getSample = (sIdx) => {
                const byteOff = offset + (p * samples + sIdx) * bytesPerSample;
                if (byteOff + bytesPerSample > buffer.byteLength) return 0;
                if (bps === 32) return view.getFloat32(byteOff, isLE);
                if (bps === 16) return format === 2 ? view.getInt16(byteOff, isLE) : view.getUint16(byteOff, isLE);
                return view.getUint8(byteOff);
            };

            let r, g, b;
            if (samples >= 3) {
                const rIdx = samples >= 5 ? 2 : 0;
                const gIdx = 1;
                const bIdx = samples >= 5 ? 0 : 2;
                r = getSample(rIdx);
                g = getSample(gIdx);
                b = getSample(bIdx);
            } else {
                r = g = b = getSample(0);
            }

            rVals[pixelIdx] = r;
            gVals[pixelIdx] = g;
            bVals[pixelIdx] = b;

            if (!isNaN(r) && isFinite(r)) {
                if (r < minV) minV = r;
                if (r > maxV) maxV = r;
            }
            if (!isNaN(g) && isFinite(g)) {
                if (g < minV) minV = g;
                if (g > maxV) maxV = g;
            }
            if (!isNaN(b) && isFinite(b)) {
                if (b < minV) minV = b;
                if (b > maxV) maxV = b;
            }
            pixelIdx++;
        }
    }

    let range = maxV - minV;
    if (range <= 0 || !isFinite(range)) range = 1;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const imgData = ctx.createImageData(width, height);
    for (let i = 0; i < totalPixels; i++) {
        const rNorm = Math.min(255, Math.max(0, Math.round(((rVals[i] - minV) / range) * 255)));
        const gNorm = Math.min(255, Math.max(0, Math.round(((gVals[i] - minV) / range) * 255)));
        const bNorm = Math.min(255, Math.max(0, Math.round(((bVals[i] - minV) / range) * 255)));
        const idx4 = i * 4;
        imgData.data[idx4] = rNorm;
        imgData.data[idx4 + 1] = gNorm;
        imgData.data[idx4 + 2] = bNorm;
        imgData.data[idx4 + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);
    return canvas.toDataURL("image/png");
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


            const isTiff =
                file.name.toLowerCase().endsWith(".tif") ||
                file.name.toLowerCase().endsWith(".tiff") ||
                file.type === "image/tiff" ||
                file.type === "image/tif";

            if (isTiff) {
                const img =
                    document.createElement(
                        "img"
                    );

                img.alt =
                    file.name;

                img.style.display =
                    "none";

                const tiffPlaceholder =
                    document.createElement(
                        "div"
                    );

                tiffPlaceholder.className =
                    "tiff-preview-placeholder";

                const tiffIcon =
                    document.createElement(
                        "div"
                    );

                tiffIcon.className =
                    "tiff-preview-icon";

                tiffIcon.textContent =
                    "🛰️";

                const tiffFilename =
                    document.createElement(
                        "div"
                    );

                tiffFilename.className =
                    "tiff-preview-filename";

                tiffFilename.textContent =
                    file.name;

                const tiffStatus =
                    document.createElement(
                        "div"
                    );

                tiffStatus.className =
                    "tiff-preview-status";

                tiffStatus.textContent =
                    "Generating preview...";

                tiffPlaceholder.appendChild(
                    tiffIcon
                );

                tiffPlaceholder.appendChild(
                    tiffFilename
                );

                tiffPlaceholder.appendChild(
                    tiffStatus
                );

                const tiffBadge =
                    document.createElement(
                        "div"
                    );

                tiffBadge.style.cssText =
                    "position:absolute; top:10px; left:10px; background:rgba(15,23,42,0.85); color:#7dd3fc; font-size:11px; font-weight:600; padding:4px 8px; border-radius:4px; border:1px solid rgba(125,211,252,0.35); z-index:2; pointer-events:none; display:none;";

                tiffBadge.textContent =
                    "Multispectral TIFF • Preview";

                card.style.position =
                    "relative";

                card.appendChild(
                    tiffPlaceholder
                );

                card.appendChild(
                    img
                );

                card.appendChild(
                    tiffBadge
                );

                getTiffPreviewURL(file).then(
                    (previewUrl) => {
                        if (previewUrl) {
                            img.src = previewUrl;
                            img.style.display = "block";
                            tiffBadge.style.display = "block";
                            tiffPlaceholder.style.display = "none";
                        } else {
                            tiffStatus.textContent = "Multispectral TIFF • Preview unavailable";
                        }
                    }
                ).catch(() => {
                    tiffStatus.textContent = "Multispectral TIFF • Preview unavailable";
                });
            } else {
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

                card.appendChild(
                    img
                );
            }


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


  


    try {
    await saveChat();

    const routerResponse =
        await callRouter(query);

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


                const isTiff =
                    file.name.toLowerCase().endsWith(".tif") ||
                    file.name.toLowerCase().endsWith(".tiff") ||
                    file.type === "image/tiff" ||
                    file.type === "image/tif";

                if (isTiff) {
                    const previewWrapper =
                        document.createElement(
                            "div"
                        );

                    previewWrapper.style.cssText =
                        "display:inline-flex; flex-direction:column; align-items:flex-start; gap:6px; margin-top:6px;";

                    const img =
                        document.createElement(
                            "img"
                        );

                    img.alt =
                        file.name;

                    img.title =
                        "Click to view TIFF preview";

                    img.style.cssText =
                        "max-width:160px; max-height:160px; border-radius:6px; object-fit:cover; display:none; cursor:pointer; border:1px solid rgba(125,211,252,0.3);";

                    const tiffBadge =
                        document.createElement(
                            "div"
                        );

                    tiffBadge.className =
                        "question-tiff-badge";

                    tiffBadge.innerHTML =
                        `<span>🛰️</span> <strong>${escapeHTML(file.name)}</strong> <span style="color:#7dd3fc; font-size:11px;">(Multispectral TIFF • Preview)</span>`;

                    previewWrapper.appendChild(
                        img
                    );

                    previewWrapper.appendChild(
                        tiffBadge
                    );

                    wrapper.appendChild(
                        previewWrapper
                    );

                    getTiffPreviewURL(file).then(
                        (previewUrl) => {
                            if (previewUrl) {
                                img.src = previewUrl;
                                img.style.display = "block";
                                img.addEventListener(
                                    "click",
                                    () => {
                                        window.open(
                                            previewUrl,
                                            "_blank"
                                        );
                                    }
                                );
                            }
                        }
                    ).catch(() => {});
                } else {
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
                }


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

    const rawResults =
        Array.isArray(data.results)
            ? data.results
            : [];

    const hasChangeFormer =
        tasks.some((t) => String(t).toLowerCase().includes("changeformer")) ||
        tools.some((t) => String(t).toLowerCase().includes("changeformer")) ||
        rawResults.some((r) => {
            const toolStr = String(r.tool || "").toLowerCase();
            const typeStr = String((r.output && r.output.analysis_type) || "").toLowerCase();
            return toolStr.includes("changeformer") || typeStr.includes("changeformer");
        });

    const isChangeDetectionResponse =
        hasChangeFormer ||
        tasks.some((t) => String(t).toLowerCase().includes("change")) ||
        tools.some((t) => String(t).toLowerCase().includes("change")) ||
        rawResults.some((r) => {
            const toolStr = String(r.tool || "").toLowerCase();
            const typeStr = String((r.output && r.output.analysis_type) || "").toLowerCase();
            return toolStr.includes("change") || typeStr.includes("change");
        });

    const hasNDVI =
        tasks.some((t) => String(t).toLowerCase().includes("ndvi") || String(t).toLowerCase().includes("vegetation")) ||
        tools.some((t) => String(t).toLowerCase().includes("ndvi") || String(t).toLowerCase().includes("vegetation")) ||
        rawResults.some((r) => {
            const toolStr = String(r.tool || "").toLowerCase();
            const typeStr = String((r.output && r.output.analysis_type) || "").toLowerCase();
            return toolStr.includes("ndvi") || typeStr.includes("ndvi") || toolStr.includes("vegetation") || typeStr.includes("vegetation") ||
                   (r.output && r.output.result && typeof r.output.result === "object" && "mean_value" in r.output.result && r.evidence && "vegetation_percentage" in r.evidence);
        });

    const hasNDWI =
        tasks.some((t) => String(t).toLowerCase().includes("ndwi") || String(t).toLowerCase().includes("water")) ||
        tools.some((t) => String(t).toLowerCase().includes("ndwi") || String(t).toLowerCase().includes("water")) ||
        rawResults.some((r) => {
            const toolStr = String(r.tool || "").toLowerCase();
            const typeStr = String((r.output && r.output.analysis_type) || "").toLowerCase();
            return toolStr.includes("ndwi") || typeStr.includes("ndwi") || toolStr.includes("water") || typeStr.includes("water") ||
                   (r.output && r.output.result && typeof r.output.result === "object" && "mean_value" in r.output.result && r.evidence && "water_percentage" in r.evidence);
        });

    const isCleanCardResponse =
        isChangeDetectionResponse ||
        hasNDVI ||
        hasNDWI;

    const displayResults = rawResults.filter((result) => {
        const toolStr = String(result.tool || "").toLowerCase();
        const typeStr = String((result.output && result.output.analysis_type) || "").toLowerCase();
        if (hasChangeFormer && (toolStr === "change_detection" || typeStr === "change_detection")) {
            return false;
        }
        return true;
    });

    if (isCleanCardResponse) {
        message.innerHTML = `
            <div class="message-label">
                SATQUERY AI
            </div>
        `;
    } else {
        message.innerHTML = `

            <div class="message-label">
                SATQUERY AI
            </div>

            <h3>
                Analysis Result
            </h3>

            <div class="router-answer">
                ${escapeHTML(
                    formatAnswerText(data.answer) ||
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
    }


    /*
       DETAILED RESULTS
    */

    if (
        displayResults.length > 0
    ) {

        const resultsContainer =
            document.createElement(
                "div"
            );


        resultsContainer.className =
            "router-results";


        if (!isCleanCardResponse) {
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
        }


        displayResults.forEach(
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

                const output =
                    result.output || {};

                const analysisType =
                    output.analysis_type ||
                    tool;

                const typeStr =
                    String(analysisType || tool || "").toLowerCase();

                const isNDVI =
                    typeStr.includes("ndvi") ||
                    typeStr.includes("vegetation") ||
                    (output.result && typeof output.result === "object" && "mean_value" in output.result && result.evidence && "vegetation_percentage" in result.evidence);

                const isNDWI =
                    typeStr.includes("ndwi") ||
                    typeStr.includes("water") ||
                    (output.result && typeof output.result === "object" && "mean_value" in output.result && result.evidence && "water_percentage" in result.evidence);

                const isChange =
                    typeStr.includes("change") ||
                    (output.result && typeof output.result === "object" && ("changed_pixels" in output.result || "changed_percentage" in output.result));

                const isCleanCard = isNDVI || isNDWI || isChange;

                let html = "";

                if (!isCleanCard) {
                    html += `
                        <div class="router-result-tool">
                            ${escapeHTML(
                                String(
                                    tool
                                ).toUpperCase()
                            )}
                        </div>
                    `;
                }


                if (
                    result.output
                ) {

                    if (!isCleanCard) {
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
                    }


                    if (
                        output.result
                    ) {

                        html +=
                            buildResultHTML(
                                output.result,
                                analysisType,
                                tool,
                                result.evidence,
                                result.output_files
                            );

                    }

                }


                /*
                   OUTPUT FILES (for non-clean-card tools if any)
                */

                if (
                    result.output_files &&
                    !isCleanCard
                ) {

                    const outputFiles =
                        result.output_files;

                    const mapPath =
                        typeof outputFiles === "object" && outputFiles !== null
                            ? (outputFiles.map ||
                               outputFiles.image ||
                               Object.values(outputFiles).find(
                                   (val) =>
                                       typeof val === "string" &&
                                       /\.(png|jpe?g|webp|gif)$/i.test(val)
                               ))
                            : null;

                    let mapImageHTML = "";
                    if (mapPath && typeof mapPath === "string") {
                        const filename = mapPath.split(/[/\\]/).pop();
                        let routerBase = "http://localhost:8000";
                        try {
                            routerBase = new URL(ROUTER_URL).origin;
                        } catch (e) {
                            // ignore
                        }
                        const routerFileUrl = `${routerBase}/api/router/files/${encodeURIComponent(filename)}`;
                        const rootFileUrl = `/${mapPath.replace(/^\/+/, "")}`;
                        mapImageHTML = `
                            <div class="router-map-preview" style="margin-top: 10px;">
                                <div style="font-weight: 600; font-size: 13px; margin-bottom: 6px; color: #cbd5e1;">Change Map Visualization:</div>
                                <img
                                    src="${routerFileUrl}"
                                    data-fallback-root="${escapeHTML(rootFileUrl)}"
                                    data-fallback-rel="${escapeHTML(mapPath)}"
                                    alt="Change Detection Map"
                                    style="max-width: 100%; height: auto; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.2); display: block;"
                                    onerror="if (!this.dataset.fallbackCount) { this.dataset.fallbackCount = '1'; this.src = this.dataset.fallbackRoot; } else if (this.dataset.fallbackCount === '1') { this.dataset.fallbackCount = '2'; this.src = this.dataset.fallbackRel; }"
                                />
                            </div>
                        `;
                    }

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
                            ${mapImageHTML}

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
                    result.warnings.length > 0 &&
                    !isCleanCard
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
   SPECTRAL ANALYSIS FORMATTERS
   ========================================= */

function formatAnswerText(text) {
    if (!text || typeof text !== "string") {
        return text;
    }
    return text.replace(/(-?\d+\.\d{3,})/g, (match) => {
        const num = Number(match);
        return isNaN(num) ? match : num.toFixed(2);
    });
}

function getNDVIInterpretation(mean) {
    if (mean >= 0.5) {
        return "Dense, healthy vegetation is present.";
    } else if (mean >= 0.2) {
        return "Moderate vegetation is present.";
    } else if (mean >= 0.1) {
        return "Sparse or low vegetation is present.";
    } else if (mean >= 0.0) {
        return "Very low vegetation / barren or built-up area.";
    }
    return "No vegetation detected (water, rock, or clouds).";
}

function getNDWIInterpretation(mean) {
    if (mean >= 0.3) {
        return "Open water body / high water presence detected.";
    } else if (mean >= 0.0) {
        return "High surface moisture or water surface present.";
    } else if (mean >= -0.3) {
        return "Moderate surface moisture / non-water or vegetated surfaces.";
    }
    return "Low water content / mostly dry or non-water surfaces.";
}


/* =========================================
   BUILD RESULT HTML
   ========================================= */

function buildResultHTML(
    result,
    analysisType,
    tool,
    evidence,
    outputFiles
) {

    if (
        result === null ||
        result === undefined
    ) {

        return "";

    }

    const typeStr =
        String(analysisType || tool || "").toLowerCase();

    const isNDVI =
        typeStr.includes("ndvi") ||
        typeStr.includes("vegetation") ||
        (result && typeof result === "object" && "mean_value" in result && evidence && "vegetation_percentage" in evidence);

    const isNDWI =
        typeStr.includes("ndwi") ||
        typeStr.includes("water") ||
        (result && typeof result === "object" && "mean_value" in result && evidence && "water_percentage" in evidence);

    const isChange =
        typeStr.includes("change") ||
        (result && typeof result === "object" && ("changed_pixels" in result || "changed_percentage" in result));

    if (isNDVI && typeof result === "object" && ("mean_value" in result)) {
        const avg = Number(result.mean_value || 0);
        const min = Number(result.min_value !== undefined ? result.min_value : -1);
        const max = Number(result.max_value !== undefined ? result.max_value : 1);
        const vegPct = evidence && evidence.vegetation_percentage !== undefined ? Number(evidence.vegetation_percentage) : null;
        const interp = getNDVIInterpretation(avg);

        return `
            <div class="spectral-result-card ndvi">
                <div class="spectral-card-title">
                    <span>🌱</span> <span>Vegetation Analysis</span>
                </div>
                <div class="spectral-card-body">
                    <div>Average NDVI: <strong>${avg.toFixed(2)}</strong></div>
                    <div>Range: <strong>${min.toFixed(2)} → ${max.toFixed(2)}</strong></div>
                    ${vegPct !== null ? `<div>Vegetation Coverage: <strong>${vegPct.toFixed(1)}%</strong></div>` : ""}
                    <div>Interpretation: <em>${escapeHTML(interp)}</em></div>
                    <div class="spectral-card-success">✓ Analysis completed successfully</div>
                </div>
            </div>
        `;
    }

    if (isNDWI && typeof result === "object" && ("mean_value" in result)) {
        const avg = Number(result.mean_value || 0);
        const min = Number(result.min_value !== undefined ? result.min_value : -1);
        const max = Number(result.max_value !== undefined ? result.max_value : 1);
        const waterPct = evidence && evidence.water_percentage !== undefined ? Number(evidence.water_percentage) : null;
        const interp = getNDWIInterpretation(avg);

        return `
            <div class="spectral-result-card ndwi">
                <div class="spectral-card-title">
                    <span>💧</span> <span>Water Index Analysis</span>
                </div>
                <div class="spectral-card-body">
                    <div>Average NDWI: <strong>${avg.toFixed(2)}</strong></div>
                    <div>Range: <strong>${min.toFixed(2)} → ${max.toFixed(2)}</strong></div>
                    ${waterPct !== null ? `<div>Water Coverage: <strong>${waterPct.toFixed(1)}%</strong></div>` : ""}
                    <div>Interpretation: <em>${escapeHTML(interp)}</em></div>
                    <div class="spectral-card-success">✓ Analysis completed successfully</div>
                </div>
            </div>
        `;
    }

    if (isChange && typeof result === "object") {
        const changedPx =
            result.changed_pixels !== undefined
                ? Number(result.changed_pixels)
                : (result.changedPixels !== undefined ? Number(result.changedPixels) : null);
        const totalPx =
            result.total_pixels !== undefined
                ? Number(result.total_pixels)
                : (result.totalPixels !== undefined ? Number(result.totalPixels) : null);

        let changedPct = null;
        if (result.changed_percentage !== undefined && result.changed_percentage !== null) {
            changedPct = Number(result.changed_percentage);
        } else if (result.change_percentage !== undefined && result.change_percentage !== null) {
            changedPct = Number(result.change_percentage);
        } else if (result.percentage !== undefined && result.percentage !== null) {
            changedPct = Number(result.percentage);
        } else if (changedPx !== null && totalPx !== null && totalPx > 0) {
            changedPct = (changedPx / totalPx) * 100;
        }

        const isChangeFormer =
            typeStr.includes("changeformer") ||
            (tool && String(tool).toLowerCase().includes("changeformer")) ||
            (outputFiles && typeof outputFiles.map === "string" && outputFiles.map.toLowerCase().includes("changeformer")) ||
            (result.model && String(result.model).toLowerCase().includes("changeformer"));

        const statusText = isChangeFormer
            ? "✓ ChangeFormer analysis completed"
            : "✓ Analysis completed successfully";

        return `
            <div class="spectral-result-card change">
                <div class="spectral-card-title">
                    <span>🔍</span> <span>Change Detection</span>
                </div>
                <div class="spectral-card-body">
                    <div>Changed Pixels: <strong>${changedPx !== null && !isNaN(changedPx) ? changedPx.toLocaleString() : "N/A"}</strong></div>
                    <div>Total Pixels: <strong>${totalPx !== null && !isNaN(totalPx) ? totalPx.toLocaleString() : "N/A"}</strong></div>
                    <div>Changed Area: <strong>${changedPct !== null && !isNaN(changedPct) ? changedPct.toFixed(2) + "%" : "N/A"}</strong></div>
                    <div class="spectral-card-success">${escapeHTML(statusText)}</div>
                </div>
            </div>
        `;
    }


    if (
        typeof result !== "object"
    ) {

        let displayStr = String(result);
        if (typeof result === "number" && !Number.isInteger(result)) {
            displayStr = result.toFixed(2);
        }

        return `

            <div class="router-detail">

                <strong>
                    Result
                </strong>

                <div>
                    ${escapeHTML(
                        displayStr
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
                typeof value === "number" &&
                !Number.isInteger(value)
            ) {

                displayValue =
                    value.toFixed(2);

            }

            else if (
                typeof value === "object" &&
                value !== null
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


    /*
       CLEAR PREVIOUS QUESTION INPUT
    */

    if (queryInput) {

        queryInput.value =
            "";

    }


    /*
       RESET RESULT VIEW & SHOW UPLOADED IMAGES
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


    setResultStatus(
        "READY"
    );


    if (continueButton) {

        continueButton.classList.remove(
            "visible"
        );

    }


    if (imageSession) {

        imageSession.textContent =
            `${selectedFiles.length} image${
                selectedFiles.length > 1
                    ? "s"
                    : ""
            } loaded — enter a new question below.`;

    }


    if (queryInput) {

        queryInput.focus();

    }

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

    imageGallery.classList.add(
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


        imageGallery.classList.add(
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