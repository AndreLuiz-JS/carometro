const maxSize = 250; //tamanho maximo em pixels
const proportion = 3 / 4; //proporção do recorte do rosto
const rectPadding = 8 / 100; //padding em % 

function getImageArray(inputFiles, array) { //função recebe FileList para retirar todas as imagens do input e colocar em um Array
    array.splice(0, array.length); //apaga todos os elementos presentes no array caso o usuário selecione mais de uma vez as imagens no input
    if (inputFiles.length != 0) {
        for (let i = 0; i < inputFiles.length; i++) {
            if (inputFiles[i].type === "image/jpeg" || inputFiles[i].type === "image/png")
                array.push(inputFiles[i]);
        }
    }
}

async function reduceImage(image, maxSize) { //função para reduzir o tamanho da imagem com base no parametro maxSize recebido
    const name = image.name || image.id;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const bitmap = await createImageBitmap(image)
    const bitmapWidth = (bitmap.naturalWidth || bitmap.width);
    const bitmapHeight = (bitmap.naturalHeight || bitmap.height);
    const scale = Math.min(maxSize / bitmapWidth, maxSize / bitmapHeight);
    canvas.width = bitmapWidth * scale;
    canvas.height = bitmapHeight * scale;
    const returnScale = Math.max(bitmapWidth / canvas.width, bitmapHeight / canvas.height)
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    //esta promise se autoresolve retornando o blob do canvas
    const blob = await new Promise(
        resolve => ctx.canvas.toBlob(resolve, "image/jpeg", 1)
    )
    const newFile = await new File([blob], "cropped_" + name, { type: blob.type });
    return { fileCrop: newFile, scale: returnScale, width: canvas.width, height: canvas.height };
}

async function reduceArrayImages(array, progress) {
    const newArray = [];
    progress.max = array.length;
    for (i in array) {
        newArray.push(await reduceImage(array[i], maxSize));
        array[i] = { fileOriginal: array[i] }
        progress.value = i;
    }
    $.extend(true, array, newArray);
}

async function faceDetect(image) { //função para detectar face nas imagens do array retornando o left, top, width e height
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const bitmap = await createImageBitmap(image);
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    ctx.drawImage(bitmap, 0, 0);
    const face = await new Promise(
        resolve => $(canvas).faceDetection(resolve)
    );
    console.log(`Localizado ${face.length} face na imagem ${image.name}`);
    return face;
}

async function faceDetectArray(array, progress) {
    const newArray = [];
    progress.max = array.length;
    for (i in array) {
        const face = await faceDetect(array[i].fileCrop);
        if (face.length > 0) {
            face[0].width *= array[i].scale;
            face[0].height *= array[i].scale;
            face[0].x *= array[i].scale;
            face[0].y *= array[i].scale;
        }
        newArray.push({ face: face });
        progress.value = i;
    }
    $.extend(true, array, newArray);
}

async function drawImages(array, progress) {
    progress.max = array.length;
    for (i in array) {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const scale = array[i].scale;
        if (array[i].face.length > 0) {
            progress.value = i;
            const file = array[i].fileOriginal;
            const x = (array[i].face[0].x) - (rectPadding * maxSize * scale);
            const y = (array[i].face[0].y) - (rectPadding * maxSize * scale);
            var width = array[i].face[0].width + (rectPadding * maxSize * scale * 2);
            var height = width / proportion;
            var bitmap = await createImageBitmap(
                file,
                x,
                y,
                width,
                height
            );
        } else {
            const file = array[i].fileCrop;
            if (array[i].width > array[i].height) { //landscape
                var height = array[i].width * proportion;
                var width = height * proportion;
                var newScale = maxSize / width;
                var bitmap = await createImageBitmap(file, (array[i].width - width) / 2, 0, width, height);
            } else { //portrait
                var width = array[i].width;
                var height = width / proportion;
                var bitmap = await createImageBitmap(file, 0, 0, width, height);
            }
        }
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        ctx.drawImage(bitmap, 0, 0);
        const blob = await new Promise(
            resolve => ctx.canvas.toBlob(resolve, "image/jpeg", 0.7)
        )
        array[i].fileCrop = await new File([blob], array[i].name, { type: "image/jpeg" });
        array[i].scale = {
            original: scale,
            cropped: newScale
        };
        array[i].width = bitmap.width;
        array[i].height = bitmap.height;
    }
}