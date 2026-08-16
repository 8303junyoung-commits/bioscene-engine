import { GeminiQaClient, visualReviewSchema } from './geminiClient.mjs'

const rubric=`You are a visual and UX reviewer for a biomedical figure editor. Review only visible presentation and usability; do not claim biological or scientific truth. Check: 1 overlap, 2 clipping, 3 alignment, 4 label readability, 5 whether receptor/antibody/ligand silhouettes are visually distinguishable, 6 membrane/receptor spatial relationship, 7 arrow clarity, 8 scene hierarchy, and 9 obvious UX confusion. Technical editing overlays may be absent in CLEAN mode by design. Return only the requested structured JSON.`

export async function reviewVisualCheckpoint(imagePath,context,client=new GeminiQaClient()) {
  try{
    const result=await client.generateJson({prompt:`${rubric}\n\nCheckpoint context: ${context}`,schema:visualReviewSchema,imagePath,cacheKey:`visual-v1:${context}`})
    return result.unavailable?{...result,status:'WARNING',issues:[],overallReadability:0}:result
  }
  catch(error){return {unavailable:true,status:'WARNING',issues:[],overallReadability:0,message:`Gemini review unavailable: ${error instanceof Error?error.message:String(error)}`}}
}
