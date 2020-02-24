const maxSize = 250;

function getImageArray(input){ //função recebe FileList para retirar todas as imagens do input e colocar em um Array
    const arrayImage = [];
    let notImage = 0;
    if(input.length != 0 ){
        for(let i = 0; i < input.length; i++){
            if(input[i].type === "image/jpeg" || input[i].type === "image/png"){
                arrayImage.push(input[i])
            } else {
                notImage++;
            }
        }
    } else {
    }
    return arrayImage;
}

async function reduceImage(fileImage, maxSize){ //função para reduzir o tamanho da imagem com base no parametro maxSize recebido
    const name = fileImage.name;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const bitmap = await createImageBitmap(fileImage)
    const bitmapWidth = (bitmap.naturalWidth || bitmap.width);
    const bitmapHeight = (bitmap.naturalHeight || bitmap.height);
    const scale = Math.min(maxSize / bitmapWidth, maxSize / bitmapHeight);
    canvas.width = bitmapWidth * scale;
    canvas.height = bitmapHeight * scale;
    const returnScale = Math.max(bitmapWidth/canvas.width, bitmapHeight/canvas.height)
    ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
    //esta promise se autoresolve retornando o blob do canvas
    const blob = await new Promise(
        resolve => ctx.canvas.toBlob(resolve,'image/jpeg', 1)
    )
    const newFile = await new File ([blob], 'cropped_'+name, {type: blob.type});
    return {file: newFile, scale: returnScale};
}

async function reduceImages(images, maxSize){
    const arrayImage = [];
    for (i in images){
        arrayImage.push(await reduceImage(images[i].file,maxSize));
    }
    return arrayImage;
}

async function faceDetect(image){//função para detectar face nas imagens do array retornando o left, top, width e height
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const imageReduced = await reduceImage(image,maxSize);
    const bitmap = await createImageBitmap(imageReduced.file);
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    ctx.drawImage(bitmap,0,0);
    const face = await new Promise(
        resolve => $(canvas).faceDetection(resolve)
    )
    console.log(`Localizado ${face.length} face na imagem ${image.id}`)
    if (face.length == 0) {
        return {
            file: imageReduced.file,
            hasFace: false
        }
    } else {
        return {
            fileCrop: imageReduced.file,
            fileOriginal: image,
            hasFace: true,
            scale: imageReduced.scale,
            face: face[0],
            canvas: canvas,
            ctx: ctx
        };
    }
}

async function faceDetectArray(arrayImage){
    const result = [];
    for(i in arrayImage){
        //face detect retorna uma url de imagem com o rosto ou false se não detectar nenhum rosto
        let obj = await faceDetect(arrayImage[i]);
        result[i] = {hasFace: obj.hasFace,
                        scale: obj.scale,
                        face: obj.face,
                        canvas:obj.canvas,
                        ctx: obj.ctx,
                        fileCrop: obj.file,
                        fileOriginal: arrayImage[i],
                        name: arrayImage[i].name}
    }
    return result;
}

async function drawImages(arrayImageFaceDetected){
    for (i in arrayImageFaceDetected){
        const file = arrayImageFaceDetected[i].fileOriginal;
        if(arrayImageFaceDetected[i].hasFace === false){
            file.src = URL.createObjectURL(arrayImageFaceDetected[i].fileCrop);
        } else {
            const canvas = arrayImageFaceDetected[i].canvas;
            const ctx = arrayImageFaceDetected[i].ctx;
            const scale = arrayImageFaceDetected[i].scale;
            const proportion = canvas.height/canvas.width;
            const x = (arrayImageFaceDetected[i].face.x-50)*scale;
            const y = (arrayImageFaceDetected[i].face.y-25)*scale;
            const width = (arrayImageFaceDetected[i].face.width+100)*scale;
            const height = width*proportion;
            const bitmap = await createImageBitmap(
                file,
                x,
                y,
                width,
                height,
                {resizeWidth: maxSize}
            );
            ctx.drawImage(bitmap,0,0);
            file.src = ctx.canvas.toDataURL('image/jpeg',1)
            console.log(file)
        }
    }
}