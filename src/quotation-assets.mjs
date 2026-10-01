export const QUOTATION_ASSET_BUCKET='crm-quotation-assets';
export const QUOTATION_ASSET_LIMIT=2*1024*1024;
export function validateQuotationAsset(file){
 if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('PNG, JPG or WebP required');
 if(!file.size||file.size>QUOTATION_ASSET_LIMIT)throw Error('Image must be no larger than 2 MB');
}
export function imageDataUrl(blob){
 return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Cannot read image'));reader.readAsDataURL(blob);});
}
export async function readQuotationImage(file){
 validateQuotationAsset(file);
 const url=await imageDataUrl(file),img=new Image();img.src=url;
 await img.decode();
 if(!img.naturalWidth||!img.naturalHeight||img.naturalWidth>8000||img.naturalHeight>8000)throw Error('Image dimensions are invalid or exceed 8000 px');
 return url;
}
export async function uploadQuotationAsset(client,file,ownerId,kind){
 validateQuotationAsset(file);
 if(!ownerId||!['logo','seller-signature'].includes(kind))throw Error('Invalid quotation asset owner or kind');
 const ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[file.type];
 const key=ownerId+'/'+kind+'-'+crypto.randomUUID()+'.'+ext;
 const {error}=await client.storage.from(QUOTATION_ASSET_BUCKET).upload(key,file,{upsert:false,contentType:file.type,cacheControl:'3600'});
 if(error)throw error;
 return key;
}
export async function downloadQuotationAsset(client,key){
 const {data,error}=await client.storage.from(QUOTATION_ASSET_BUCKET).download(key);
 if(error)throw error;
 if(!data)throw Error('Quotation image unavailable');
 return imageDataUrl(data);
}
