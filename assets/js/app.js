
import { createClient } from './vendor/supabase.js';
import { createPaymentUI } from './payments.js';
import { validateUpload } from './upload-policy.js';
import { t, applyTranslations, TRANSLATIONS } from './i18n.js';
const PREVIEW_MODE=false;
const SUPABASE_URL="https://bjnkgxkcbbnbtazelsjs.supabase.co";
const SUPABASE_KEY="sb_publishable_F49fzNl_CTWUdJy5ZdMDMw_MFrIOXw-";
const EDGE_URL=`${SUPABASE_URL}/functions/v1/shia-order-intake`;
const supabase=PREVIEW_MODE?null:createClient(SUPABASE_URL,SUPABASE_KEY);
const $=s=>document.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)], esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));

// Mark generated interface text only. User values, canonical names and IDs are untouched.
const localized=(source,params={})=>`<span data-i18n="${esc(source)}" data-i18n-params="${esc(JSON.stringify(params))}">${esc(t(source,params))}</span>`;
function setText(element,source,params={}){element.dataset.i18n=source;element.dataset.i18nParams=JSON.stringify(params);element.textContent=t(source,params)}
function localizeMarkup(html){
  const template=document.createElement('template');template.innerHTML=html;
  const walker=document.createTreeWalker(template.content,NodeFilter.SHOW_TEXT),nodes=[];
  while(walker.nextNode())nodes.push(walker.currentNode);
  for(const node of nodes){const source=node.textContent.trim();if(source&&Object.hasOwn(TRANSLATIONS,source)&&!node.parentElement.closest('[data-i18n],textarea')){const span=document.createElement('span');span.dataset.i18n=source;span.textContent=t(source);node.replaceWith(span)}}
  for(const element of template.content.querySelectorAll('[placeholder],[aria-label],[title]'))for(const attr of ['placeholder','aria-label','title']){const source=element.getAttribute(attr);if(source&&Object.hasOwn(TRANSLATIONS,source)){element.setAttribute(`data-i18n-${attr}`,source);element.setAttribute(attr,t(source))}}
  return template.innerHTML;
}


// Motion is optional: core forms also work if its separate module fails to load.
const scrollBehavior=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth';
const animateStep=element=>window.ShiaMotion?.animateStep(element);

/* Decorative SVGs inherit the control's accessible name. */
const iconPaths={arrow:'M6 18 18 6M6 6h12v12',up:'m6 14 6-6 6 6',down:'m6 10 6 6 6-6',remove:'m6 6 12 12M18 6 6 18'};
const icon=name=>`<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${iconPaths[name]}"/></svg>`;

/* ---------- field helpers ---------- */
const text=(n,o={})=>({t:'text',n,...o}), num=(n,o={})=>({t:'num',n,...o}), date=(n,o={})=>({t:'date',n,...o});
const area=(n,o={})=>({t:'area',n,...o}), pick=(n,o,x={})=>({t:'radio',n,o,...x}), note=t=>({t:'note',text:t});
const LANG=pick('Idioma',['Español','Inglés','Bilingüe'],{req:true});
const styleStep=(styles,moods)=>({k:'Estilo musical',h:'¿Cómo quiere que suene?',f:[
  pick('Estilo musical',styles,{req:true}),
  text('Otro estilo',{ph:'Ej. bolero, sierreño, acústico'}),
  pick('Emoción',moods,{req:true}),
  pick('Duración deseada',['Corta (1–2 min)','Normal (2–3 min)','Larga (3–4 min)','Usted decide'])]});
const POP=['Banda','Balada','Mariachi','Norteño','Pop','Country','Otro'];
const SOFT=['Balada','Acústica','Góspel','Mariachi','Norteña','Piano','Otro'];

/* ---------- song templates ---------- */
const TEMPLATES={

aniversario:{name:'Aniversario de bodas',blurb:'Para una pareja que celebra sus años juntos.',
 title:'Crea una canción que cuente su historia',
 blurbLong:'Complete el formulario paso a paso. Sus respuestas y archivos se enviarán de forma privada a Shia Songs.',
 meta:a=>({title:`Canción para ${a['Nombre del esposo']||''} y ${a['Nombre de la esposa']||''}`.trim(),subject:`${a['Nombre del esposo']||''} y ${a['Nombre de la esposa']||''}`,date:a['Fecha del aniversario'],years:Number(a['Años de casados'])||null}),
 steps:[
 {k:'Información básica',h:'Comencemos con ustedes',f:[text('Nombre del esposo',{req:true,half:1}),text('Nombre de la esposa',{req:true,half:1}),num('Años de casados',{req:true,half:1,min:1,max:100}),date('Fecha del aniversario',{req:true,half:1}),LANG]},
 styleStep(POP,['Romántica','Alegre','Nostálgica','Inspiradora','Otra']),
 {k:'Su historia',h:'Cuéntenos cómo comenzó todo',f:[area('Cómo se conocieron',{req:true}),num('Edad de él al conocerse',{half:1}),num('Edad de ella al conocerse',{half:1}),area('Quién dio el primer paso'),area('Primera cita'),area('Cuándo supieron que era para siempre')]},
 {k:'Matrimonio',h:'La vida que han construido',f:[num('Edad de él al casarse',{half:1}),num('Edad de ella al casarse',{half:1}),area('Qué fortaleció el matrimonio'),area('Obstáculos superados'),area('Recuerdo favorito como pareja')]},
 {k:'Familia',h:'Las personas que forman parte de su historia',f:[area('Hijos',{ph:'Nombres y detalles especiales'}),area('Nietos',{ph:'Nombres y detalles especiales'}),pick('Mencionar familia',['Sí','No','Solo algunos'])]},
 {k:'Recuerdos',h:'Los momentos que nunca olvidarán',f:[area('Viaje favorito'),area('Tradición favorita'),area('Momento inolvidable')]},
 {k:'Lo que aman del otro',h:'Las cualidades que más admiran',f:[area('Lo que él admira'),area('Lo que ella admira'),text('Apodos',{half:1}),text('Lugar favorito',{half:1}),text('Canción favorita',{half:1}),text('Comida favorita',{half:1}),area('Pasatiempos juntos')]},
 {k:'Fe y mensaje',h:'Lo que desean expresar desde el corazón',f:[pick('Incluir fe',['Sí','No']),area('Mensaje de fe'),area('Mensaje final',{req:true,ph:'¿Qué le gustaría decirle hoy a su pareja?'}),area('Información adicional',{ph:'Detalle, fecha, frase o anécdota adicional'})]}]},

memorial:{name:'En memoria de un ser querido',blurb:'Una canción que honra la vida de alguien que ya partió.',
 title:'Una canción para honrar su vida',
 blurbLong:'Tómese el tiempo que necesite. Solo unas pocas preguntas son obligatorias — conteste lo que pueda y deje en blanco lo que sea muy difícil. Todo llega de forma privada a Shia Songs.',
 meta:a=>({title:`En memoria de ${a['Nombre completo de la persona']||''}`.trim(),subject:a['Nombre completo de la persona']||null,date:a['Fecha en que partió']||null,years:null}),
 steps:[
 {k:'Información básica',h:'Hábleme de quien vamos a honrar',f:[
   note('Sentimos mucho su pérdida. Escribimos estas canciones con todo el respeto que merece su ser querido. No hay respuestas incorrectas y puede dejar cualquier pregunta en blanco.'),
   text('Nombre completo de la persona',{req:true,half:1}),text('Apodo o cómo le decían',{half:1}),
   text('Relación con usted',{req:true,half:1,ph:'Ej. mi hijo, mi mamá, mi hermano'}),
   text('Su nombre (quien pide la canción)',{half:1}),
   date('Fecha de nacimiento',{half:1}),date('Fecha en que partió',{half:1}),
   num('Edad que tenía',{half:1}),text('De dónde era',{half:1}),LANG]},
 styleStep(SOFT,['Consoladora','Celebrar su vida','Nostálgica','Esperanza y fe','Otra']),
 {k:'Quién era',h:'Cómo era él o ella de verdad',f:[
   area('Cómo describiría su personalidad',{req:true,ph:'Alegre, tranquilo, bromista, protector…'}),
   area('Qué le apasionaba',{ph:'Trabajo, música, deportes, sus animales, su carro…'}),
   area('Cómo era su risa o su sonrisa'),
   area('Qué hacía sentir a la gente cuando entraba a un cuarto'),
   area('Qué es lo que más extraña de él o de ella')]},
 {k:'Recuerdos',h:'Los momentos que quiere guardar para siempre',f:[
   area('Recuerdo favorito juntos',{req:true}),
   area('El primer recuerdo que tiene de él o ella'),
   area('Algo gracioso que siempre recuerdan en familia'),
   area('Una tradición o costumbre que compartían'),
   area('Un logro del que estaba orgulloso')]},
 {k:'Su voz',h:'Las cosas suyas que todos reconocen',f:[
   area('Frases o dichos que siempre decía'),
   text('Apodos que él o ella ponía',{half:1}),text('Canción o artista favorito',{half:1}),
   text('Comida favorita',{half:1}),text('Lugar favorito',{half:1}),
   text('Equipo, pasatiempo u oficio',{half:1}),text('Color favorito',{half:1})]},
 {k:'Familia y legado',h:'Las personas que lleva con él',f:[
   area('Familia cercana',{ph:'Padres, hermanos, pareja, hijos — nombres que le gustaría escuchar en la canción'}),
   pick('Mencionar nombres de familia',['Sí','No','Solo algunos']),
   area('Amigos o personas importantes en su vida'),
   area('Qué dejó en quienes lo conocieron'),
   area('Cómo lo recuerda la familia hoy')]},
 {k:'Fe y mensaje',h:'Lo que quiere decirle',f:[
   pick('Incluir fe',['Sí','No']),
   area('Mensaje de fe',{ph:'Un versículo, una oración o lo que su fe significa en este momento'}),
   area('Mensaje final',{req:true,ph:'Si pudiera decirle algo hoy, ¿qué le diría?'}),
   area('Cómo quiere que se sienta quien escuche la canción')]},
 {k:'Cuidados',h:'Lo que prefiere que no se mencione',f:[
   note('Esta parte es importante. Nos dice qué evitar para que la canción no lastime a nadie de la familia.'),
   pick('Mencionar cómo falleció',['Sí','No','Solo de forma delicada']),
   area('Temas, palabras o personas que NO se deben mencionar'),
   area('Quiénes van a escuchar la canción',{ph:'Ej. su mamá, sus hermanos, en el aniversario, en la misa'}),
   area('Información adicional',{ph:'Cualquier otro detalle que nos ayude a escribirla bien'})]}]},

cumpleanos:{name:'Cumpleaños',blurb:'Para sorprender a alguien el día de su cumpleaños.',
 title:'Una canción para su cumpleaños',
 meta:a=>({title:`Cumpleaños de ${a['Nombre del festejado']||''}`.trim(),subject:a['Nombre del festejado']||null,date:a['Fecha del cumpleaños']||null,years:Number(a['Edad que cumple'])||null}),
 steps:[
 {k:'Información básica',h:'¿Para quién es la canción?',f:[text('Nombre del festejado',{req:true,half:1}),text('Apodo',{half:1}),num('Edad que cumple',{half:1,min:1,max:120}),date('Fecha del cumpleaños',{half:1}),text('De parte de quién',{req:true,half:1,ph:'Ej. su esposa, sus hijos, sus amigos'}),text('Relación con el festejado',{half:1}),LANG]},
 styleStep(['Banda','Mariachi','Pop','Reggaetón','Rap','Balada','Country','Otro'],['Alegre','Divertida','Emotiva','Romántica','Otra']),
 {k:'Quién es',h:'Cómo es la persona',f:[area('Cómo es su personalidad',{req:true}),area('Qué le apasiona'),area('Cómo lo describen sus amigos'),area('Algo que logró este año')]},
 {k:'Historias',h:'Las anécdotas que hacen reír',f:[area('Recuerdo favorito juntos',{req:true}),area('Anécdota graciosa'),text('Apodos',{half:1}),text('Frases que siempre dice',{half:1})]},
 {k:'Favoritos',h:'Los detalles que lo hacen único',f:[text('Canción o artista favorito',{half:1}),text('Comida favorita',{half:1}),text('Lugar favorito',{half:1}),text('Equipo o pasatiempo',{half:1}),area('Personas a mencionar',{ph:'Nombres de familia o amigos que quiere escuchar en la canción'})]},
 {k:'Mensaje',h:'Lo que quiere decirle',f:[pick('Incluir fe',['Sí','No']),area('Mensaje de fe'),area('Mensaje final',{req:true,ph:'¿Qué le quiere decir en su día?'}),area('Información adicional')]}]},

boda:{name:'Boda',blurb:'Para el primer baile, la entrada o el video de la boda.',
 title:'La canción de su boda',
 meta:a=>({title:`Boda de ${a['Nombres de los novios']||''}`.trim(),subject:a['Nombres de los novios']||null,date:a['Fecha de la boda']||null,years:null}),
 steps:[
 {k:'Información básica',h:'Los novios',f:[text('Nombres de los novios',{req:true,ph:'Ej. Carlos y Ana'}),date('Fecha de la boda',{req:true,half:1}),text('Lugar de la boda',{half:1}),pick('Momento para la canción',['Primer baile','Entrada','Vals','Video / slideshow','Otro'],{req:true}),LANG]},
 styleStep(POP,['Romántica','Alegre','Emotiva','Elegante','Otra']),
 {k:'Su historia',h:'Cómo llegaron hasta aquí',f:[area('Cómo se conocieron',{req:true}),area('Primera cita'),area('Qué los enamoró'),area('Cómo fue la propuesta'),area('Un obstáculo que superaron juntos')]},
 {k:'Detalles de la boda',h:'Cómo será el día',f:[area('Cómo se imaginan ese momento'),text('Canción favorita de los dos',{half:1}),text('Apodos',{half:1}),area('Familia o padrinos a mencionar'),pick('Mencionar nombres de familia',['Sí','No','Solo algunos'])]},
 {k:'Fe y mensaje',h:'Sus votos en forma de canción',f:[pick('Incluir fe',['Sí','No']),area('Mensaje de fe'),area('Mensaje final',{req:true,ph:'Frases o votos que quieren escuchar en la letra'}),area('Información adicional')]}]},

quinceanera:{name:'Quinceañera',blurb:'Para el vals, la entrada o el video de sus XV años.',
 title:'La canción de sus XV años',
 meta:a=>({title:`XV de ${a['Nombre de la quinceañera']||''}`.trim(),subject:a['Nombre de la quinceañera']||null,date:a['Fecha de la fiesta']||null,years:null}),
 steps:[
 {k:'Información básica',h:'La quinceañera',f:[text('Nombre de la quinceañera',{req:true,half:1}),text('Apodo',{half:1}),date('Fecha de la fiesta',{req:true,half:1}),text('Lugar de la fiesta',{half:1}),text('Nombres de los papás',{req:true}),pick('Momento para la canción',['Vals','Entrada','Video / slideshow','Brindis','Otro'],{req:true}),LANG]},
 styleStep(['Vals','Mariachi','Balada','Pop','Banda','Norteño','Otro'],['Emotiva','Alegre','Elegante','Nostálgica','Otra']),
 {k:'Quién es ella',h:'Cómo es la quinceañera',f:[area('Cómo es su personalidad',{req:true}),area('Qué le apasiona'),area('Sus sueños para el futuro'),area('Qué estudia o en qué destaca')]},
 {k:'Familia',h:'Las personas que la acompañan',f:[area('Papás',{ph:'Nombres y qué han significado para ella'}),area('Hermanos'),area('Padrinos'),area('Abuelos u otras personas especiales'),pick('Mencionar nombres de familia',['Sí','No','Solo algunos'])]},
 {k:'Recuerdos',h:'De niña a mujer',f:[area('Un recuerdo de cuando era niña',{req:true}),area('Anécdota graciosa'),area('Una tradición familiar'),text('Canción favorita',{half:1}),text('Comida favorita',{half:1})]},
 {k:'Fe y mensaje',h:'El mensaje de sus papás',f:[pick('Incluir fe',['Sí','No']),area('Mensaje de fe'),area('Mensaje final',{req:true,ph:'Lo que sus papás quieren decirle en este día'}),area('Información adicional')]}]},

madre_padre:{name:'Para mamá o papá',blurb:'Un homenaje al Día de las Madres, del Padre o porque sí.',
 title:'Una canción para quien lo dio todo',
 meta:a=>({title:`Homenaje para ${a['Nombre de la persona']||''}`.trim(),subject:a['Nombre de la persona']||null,date:a['Fecha del evento']||null,years:null}),
 steps:[
 {k:'Información básica',h:'¿Para quién es?',f:[pick('Para quién',['Mamá','Papá','Abuela','Abuelo','Otro'],{req:true}),text('Nombre de la persona',{req:true,half:1}),text('Apodo o cómo le dicen',{half:1}),text('De parte de quién',{req:true,half:1,ph:'Ej. sus hijos, su hija Ana'}),text('Ocasión',{half:1,ph:'Día de las Madres, cumpleaños, porque sí…'}),LANG]},
 styleStep(POP,['Emotiva','Agradecida','Alegre','Nostálgica','Otra']),
 {k:'Quién es',h:'Cómo es esa persona',f:[area('Cómo es su personalidad',{req:true}),area('Sacrificios que hizo por la familia'),area('Qué le enseñó a usted'),area('En qué se nota su fuerza')]},
 {k:'Recuerdos',h:'La casa, la cocina, la infancia',f:[area('Un recuerdo de su infancia con esa persona',{req:true}),text('Comida que preparaba',{half:1}),text('Frases que siempre decía',{half:1}),text('Canción favorita',{half:1}),text('Lugar favorito',{half:1}),area('Una tradición que mantienen')]},
 {k:'Gratitud',h:'Lo que quizá nunca le ha dicho',f:[area('Qué le agradece',{req:true}),area('Algo que nunca le ha dicho de frente'),area('Otras personas a mencionar'),pick('Mencionar nombres de familia',['Sí','No','Solo algunos'])]},
 {k:'Fe y mensaje',h:'Su mensaje final',f:[pick('Incluir fe',['Sí','No']),area('Mensaje de fe'),area('Mensaje final',{req:true}),area('Información adicional')]}]},

bebe:{name:'Bebé, bautizo o baby shower',blurb:'Para dar la bienvenida a un bebé a la familia.',
 title:'La primera canción de su bebé',
 meta:a=>({title:`Canción para ${a['Nombre del bebé']||''}`.trim(),subject:a['Nombre del bebé']||null,date:a['Fecha de nacimiento']||null,years:null}),
 steps:[
 {k:'Información básica',h:'El bebé',f:[text('Nombre del bebé',{req:true,half:1}),pick('Ocasión',['Nacimiento','Bautizo','Baby shower','Primer añito','Otro'],{req:true}),date('Fecha de nacimiento',{half:1}),text('Nombres de los papás',{req:true,half:1}),text('Padrinos',{half:1}),text('Hermanos',{half:1}),LANG]},
 styleStep(['Canción de cuna','Balada','Acústica','Mariachi','Pop','Otro'],['Tierna','Alegre','Emotiva','Esperanzadora','Otra']),
 {k:'La noticia',h:'Cómo empezó todo',f:[area('Cómo supieron que venía en camino',{req:true}),area('Cómo fue el día del nacimiento'),area('Qué significa su nombre o por qué lo eligieron'),area('A quién se parece')]},
 {k:'Deseos',h:'Lo que le desean en la vida',f:[area('Qué le desean',{req:true}),area('Qué quieren que sepa cuando crezca'),area('Familia a mencionar'),pick('Mencionar nombres de familia',['Sí','No','Solo algunos'])]},
 {k:'Fe y mensaje',h:'Su bendición',f:[pick('Incluir fe',['Sí','No']),area('Mensaje de fe'),area('Mensaje final',{req:true}),area('Información adicional')]}]},

graduacion:{name:'Graduación',blurb:'Para celebrar a quien terminó la escuela o la carrera.',
 title:'Una canción para su graduación',
 meta:a=>({title:`Graduación de ${a['Nombre del graduado']||''}`.trim(),subject:a['Nombre del graduado']||null,date:a['Fecha de la graduación']||null,years:null}),
 steps:[
 {k:'Información básica',h:'El graduado',f:[text('Nombre del graduado',{req:true,half:1}),text('Apodo',{half:1}),text('Escuela o universidad',{req:true,half:1}),text('Título o grado',{half:1}),date('Fecha de la graduación',{half:1}),text('De parte de quién',{req:true,half:1}),LANG]},
 styleStep(POP,['Orgullosa','Alegre','Emotiva','Inspiradora','Otra']),
 {k:'El camino',h:'Lo que costó llegar',f:[area('Qué estudió y por qué',{req:true}),area('Obstáculos que superó'),area('Sacrificios de la familia'),area('Quién lo apoyó siempre')]},
 {k:'Historias',h:'Los años de escuela',f:[area('Recuerdo favorito de esos años',{req:true}),area('Anécdota graciosa'),text('Apodos',{half:1}),text('Frases que dice',{half:1})]},
 {k:'Futuro',h:'Lo que viene ahora',f:[area('Qué sigue después de graduarse'),area('Sus sueños'),area('Personas a mencionar')]},
 {k:'Fe y mensaje',h:'Su mensaje',f:[pick('Incluir fe',['Sí','No']),area('Mensaje de fe'),area('Mensaje final',{req:true}),area('Información adicional')]}]},

propuesta:{name:'Propuesta o declaración de amor',blurb:'Para pedir matrimonio o decir lo que siente.',
 title:'La canción con la que se lo va a pedir',
 meta:a=>({title:`Propuesta para ${a['Nombre de la persona amada']||''}`.trim(),subject:`${a['Su nombre']||''} y ${a['Nombre de la persona amada']||''}`,date:a['Fecha planeada']||null,years:null}),
 steps:[
 {k:'Información básica',h:'Ustedes dos',f:[text('Su nombre',{req:true,half:1}),text('Nombre de la persona amada',{req:true,half:1}),date('Fecha planeada',{half:1}),text('Dónde será',{half:1}),pick('¿Es sorpresa?',['Sí','No'],{req:true}),pick('Tipo de mensaje',['Propuesta de matrimonio','Declaración de amor','Pedir perdón','Otro'],{req:true}),LANG]},
 styleStep(POP,['Romántica','Emotiva','Alegre','Sincera','Otra']),
 {k:'Su historia',h:'Cómo llegaron hasta aquí',f:[area('Cómo se conocieron',{req:true}),area('Primera cita'),area('El momento en que supo que era la persona indicada'),area('Cuánto tiempo llevan juntos')]},
 {k:'Lo que ama',h:'Por qué es esa persona',f:[area('Qué es lo que más ama de ella o de él',{req:true}),text('Apodos',{half:1}),text('Canción de los dos',{half:1}),text('Lugar favorito',{half:1}),text('Comida favorita',{half:1}),area('Un detalle pequeño que solo ustedes entienden')]},
 {k:'El momento',h:'Cómo quiere que termine la canción',f:[area('Cómo se imagina ese momento'),area('Quién estará presente'),area('Mensaje final',{req:true,ph:'La frase exacta con la que quiere terminar la canción'}),area('Información adicional')]}]},

amistad:{name:'Amistad o agradecimiento',blurb:'Para un amigo, un maestro o alguien que ayudó.',
 title:'Una canción para dar las gracias',
 meta:a=>({title:`Canción para ${a['Nombre de la persona']||''}`.trim(),subject:a['Nombre de la persona']||null,date:a['Fecha del evento']||null,years:null}),
 steps:[
 {k:'Información básica',h:'¿Para quién es?',f:[text('Nombre de la persona',{req:true,half:1}),text('Apodo',{half:1}),text('De parte de quién',{req:true,half:1}),text('Relación',{half:1,ph:'Amigo, maestro, compadre, vecino…'}),text('Motivo',{ph:'Ej. jubilación, despedida, por todo lo que hizo'}),LANG]},
 styleStep(POP,['Alegre','Agradecida','Divertida','Emotiva','Otra']),
 {k:'Su historia',h:'Cómo se conocieron',f:[area('Cómo se conocieron',{req:true}),area('Cuánto tiempo llevan de amistad'),area('Qué hizo esa persona por usted')]},
 {k:'Recuerdos',h:'Las historias que solo ustedes saben',f:[area('Recuerdo favorito juntos',{req:true}),area('Anécdota graciosa'),text('Apodos y chistes internos',{half:1}),text('Lugar donde siempre se ven',{half:1}),area('Otras personas a mencionar')]},
 {k:'Mensaje',h:'Lo que le quiere decir',f:[pick('Incluir fe',['Sí','No']),area('Mensaje de fe'),area('Mensaje final',{req:true}),area('Información adicional')]}]},

negocio:{name:'Jingle o canción para negocio',blurb:'Para promocionar un negocio, marca o evento.',
 title:'El jingle de su negocio',
 meta:a=>({title:`Jingle para ${a['Nombre del negocio']||''}`.trim(),subject:a['Nombre del negocio']||null,date:a['Fecha del evento']||null,years:null}),
 steps:[
 {k:'Información básica',h:'El negocio',f:[text('Nombre del negocio',{req:true,half:1}),text('Giro o rubro',{req:true,half:1,ph:'Ej. taller, restaurante, andamios'}),text('Ciudad o zona',{half:1}),text('Teléfono o redes a mencionar',{half:1}),LANG]},
 styleStep(['Banda','Norteño','Pop','Cumbia','Rap','Country','Otro'],['Alegre','Pegajosa','Seria y profesional','Divertida','Otra']),
 {k:'La marca',h:'Qué hace especial al negocio',f:[area('Qué vende o qué servicio da',{req:true}),area('Qué los hace diferentes de la competencia'),area('Quiénes son sus clientes'),area('Historia del negocio',{ph:'Cuándo empezó, quién lo fundó, cómo creció'})]},
 {k:'El mensaje',h:'Lo que la gente debe recordar',f:[text('Eslogan o frase de la marca',{half:1}),text('Llamado a la acción',{half:1,ph:'Ej. llámenos hoy, visítenos'}),area('Palabras que SÍ deben aparecer',{req:true}),area('Palabras que NO deben aparecer'),area('Dónde se va a usar',{ph:'Radio, redes sociales, tienda, evento'}),area('Información adicional')]}]},

personalizada:{name:'Otra ocasión',blurb:'¿No encaja en ninguna? Cuéntenos y la escribimos igual.',
 title:'Cuéntenos qué canción necesita',
 meta:a=>({title:`Canción personalizada${a['Para quién es']?` para ${a['Para quién es']}`:''}`,subject:a['Para quién es']||null,date:a['Fecha del evento']||null,years:null}),
 steps:[
 {k:'Información básica',h:'La ocasión',f:[text('Ocasión',{req:true,ph:'Ej. jubilación, despedida, aniversario de un negocio'}),text('Para quién es',{req:true,half:1}),text('De parte de quién',{req:true,half:1}),date('Fecha importante',{half:1}),LANG]},
 styleStep(POP,['Alegre','Emotiva','Romántica','Nostálgica','Inspiradora','Otra']),
 {k:'La historia',h:'Cuéntenos todo lo que podamos usar',f:[area('Cuéntenos la historia',{req:true,ph:'Escriba con libertad — mientras más detalles, mejor queda la letra'}),area('Recuerdos o anécdotas'),area('Personas a mencionar'),pick('Mencionar nombres',['Sí','No','Solo algunos'])]},
 {k:'Mensaje',h:'Lo que debe transmitir',f:[pick('Incluir fe',['Sí','No']),area('Mensaje de fe'),area('Mensaje final',{req:true}),area('Temas o palabras que NO se deben mencionar'),area('Información adicional')]}]}

};
const TEMPLATE_ORDER=['aniversario','memorial','cumpleanos','boda','quinceanera','madre_padre','bebe','graduacion','propuesta','amistad','negocio','personalizada'];

/* shared closing steps every template gets */
const PHOTOS_STEP={k:'Fotos y video',h:'Fotos para el slideshow',custom:'photos'};
const REVIEW_STEP={k:'Revisión',h:'Revise antes de enviar',custom:'review'};

/* ---------- state ---------- */
const f=$('#f');let T=null,tid=null,steps=[],cur=0,photos=[],extras=[],orders=[];
const storageKey=id=>`shia-form-v2:${id}`;
let draftEnabled=false, selectedPlan='songs', pendingSubmission=null;
const paymentUI=createPaymentUI({button:$('#checkoutButton'),panel:$('#paymentPanel'),note:$('#paymentNote')});
$$('[data-plan]').forEach(a=>a.onclick=()=>{selectedPlan=a.dataset.plan});
$('#year').textContent=new Date().getFullYear();

/* ---------- template picker ---------- */
$('#tgrid').innerHTML=TEMPLATE_ORDER.map((id,i)=>{const t=TEMPLATES[id];return `<button type="button" class="tcard record-sleeve" data-t="${id}"><span class="sleeve-face"><span class="sleeve-disc" aria-hidden="true"></span><img class="sleeve-photo" src="assets/photos/${['couple','embrace','music','embrace','listener','couple','embrace','listener','couple','music','listener','music'][i]}.webp" alt="" loading="lazy"><span class="sleeve-number">${String(i+1).padStart(2,'0')}</span><span class="sleeve-copy"><b>${localized(t.name)}</b><small>${localized(t.blurb)}</small></span></span></button>`}).join('');
$$('.tcard').forEach(b=>b.onclick=()=>chooseTemplate(b.dataset.t));

function chooseTemplate(id){
  if(pendingSubmission||f.classList.contains('submitting'))return showError('Hay una solicitud pendiente de confirmar. Termine o reintente este envío antes de comenzar otra historia.');
  tid=id;T=TEMPLATES[id];steps=[...T.steps,PHOTOS_STEP,REVIEW_STEP];
  setText($('#formTitle'),T.title);
  setText($('#formBlurb'),T.blurbLong||'Complete el formulario paso a paso. Sus respuestas y archivos se enviarán de forma privada a Shia Songs.');
  setText($('#formBadge'),T.name);
  try{draftEnabled=!!localStorage.getItem(storageKey(tid));}catch{draftEnabled=false;}
  pendingSubmission=null;
  $('#stepHost').innerHTML=localizeMarkup(steps.map(stepHTML).join(''));
  bindPhotoStep();resetPhotos();restore();
  const savedPackage=f.querySelector('[name="Paquete"]:checked');if(savedPackage)selectedPlan=savedPackage.value;
  $$('[name="Paquete"]').forEach(r=>{r.checked=r.value===selectedPlan;r.onchange=()=>selectedPlan=r.value});cur=0;
  $('#picker').classList.add('hidden');$('#formArea').classList.remove('hidden');
  ui();
  scrollTo({top:0,behavior:scrollBehavior()});
}
$('#changeTemplate').onclick=()=>{if(pendingSubmission)return showError('Hay una solicitud pendiente de confirmar. Reintente el envío antes de cambiar el tipo de canción.');save();$('#formArea').classList.add('hidden');$('#picker').classList.remove('hidden');scrollTo({top:0,behavior:scrollBehavior()})};

/* ---------- step rendering ---------- */
function fieldHTML(x){
  if(x.t==='note')return `<p class="note">${esc(x.text)}</p>`;
  if(x.t==='radio')return `<fieldset><legend>${esc(x.n)}</legend><div class="choices">${x.o.map(v=>`<label class="choice"><input type="radio" name="${esc(x.n)}" value="${esc(v)}"${x.req?' required':''}><span>${esc(v)}</span></label>`).join('')}</div></fieldset>`;
  if(x.t==='area')return `<label>${esc(x.n)}<textarea name="${esc(x.n)}"${x.req?' required':''}${x.ph?` placeholder="${esc(x.ph)}"`:''}></textarea></label>`;
  const type=x.t==='num'?'number':x.t==='date'?'date':x.t==='email'?'email':'text';
  const range=x.t==='num'?`${x.min!=null?` min="${x.min}"`:''}${x.max!=null?` max="${x.max}"`:''}`:'';
  return `<label>${esc(x.n)}<input type="${type}" name="${esc(x.n)}"${range}${x.req?' required':''}${x.ph?` placeholder="${esc(x.ph)}"`:''}></label>`;
}
function fieldsHTML(list){
  let out='',run=[];
  const flush=()=>{if(run.length){out+=`<div class="grid">${run.join('')}</div>`;run=[]}};
  for(const x of list){if(x.half){run.push(fieldHTML(x))}else{flush();out+=fieldHTML(x)}}
  flush();return out;
}
function stepHTML(s){
  let body;
  if(s.custom==='photos')body=PHOTOS_HTML;
  else if(s.custom==='review')body=REVIEW_HTML;
  else body=fieldsHTML(s.f);
  return `<section class="step"><div class="kicker">${esc(s.k)}</div><h2 tabindex="-1">${esc(s.h)}</h2>${body}</section>`;
}

const PHOTOS_HTML=`<p class="note">Estas fotos son las que se usan para el video / slideshow que acompaña la canción. Súbalas en el orden en que quiere que aparezcan y escríbale a cada una qué momento es — así el video cuenta la historia igual que la letra. Puede adjuntar hasta 20 archivos en total entre fotos y videos.</p>
<label class="upload"><input id="photoInput" type="file" accept="image/jpeg,image/png,image/webp,image/heic,.heic" multiple><strong>Agregar fotos para el slideshow</strong><small>JPG, PNG, WebP o HEIC · máximo 50 MB por foto</small></label>
<div class="count"><b id="photoCount">Sin fotos todavía</b><span>Use los botones ${icon('up')} ${icon('down')} para cambiar el orden</span></div>
<div id="thumbs" class="thumbs"></div>
<h4>Videos de referencia (opcional)</h4>
<p class="note">Si tiene clips de video que ayuden a contar su historia, súbalos aquí. Estos archivos son una referencia y no entran al slideshow.</p>
<label class="upload"><input id="extraInput" type="file" accept="video/mp4,video/quicktime,.mov" multiple><strong>Agregar videos de referencia</strong><small>MP4 o MOV · máximo 50 MB por archivo</small></label>
<div id="extraFiles" class="files"></div>`;

const REVIEW_HTML=`<div id="review" class="review"></div>
<fieldset><legend>Elija su paquete</legend><div class="choices"><label class="choice"><input type="radio" name="Paquete" value="songs" required><span>Dos canciones + letras · $20 USD</span></label><label class="choice"><input type="radio" name="Paquete" value="slideshow" required><span>Dos canciones + letras + video · $50 USD</span></label></div></fieldset>
<div class="grid"><label>Persona que realiza el pedido<input name="Persona que realiza el pedido" autocomplete="name" required></label><label>Teléfono<input name="Teléfono" type="tel" autocomplete="tel" required></label><label>Correo electrónico<input type="email" name="Correo electrónico" autocomplete="email" required></label><label>Fecha del evento<input type="date" name="Fecha del evento" required></label></div>
<label>Instrucciones especiales<textarea name="Instrucciones especiales" placeholder="Comentarios o instrucciones especiales"></textarea></label>
<label style="display:flex;gap:10px;align-items:flex-start"><input style="width:auto;margin-top:3px" type="checkbox" name="Confirmación" value="Sí" required><span>Confirmo que la información es correcta y autorizo su uso para crear mi canción personalizada.</span></label>`;

/* ---------- photos ---------- */
function bindPhotoStep(){
  $('#photoInput').onchange=e=>{addPhotos(e.target.files);e.target.value=''};
  $('#extraInput').onchange=e=>{addExtras(e.target.files);e.target.value=''};
}
function resetPhotos(){photos.forEach(p=>URL.revokeObjectURL(p.url));photos=[];extras=[];renderPhotos();renderExtras()}
function rejectFile(file,kind){
  const error=validateUpload(file,kind,photos.length+extras.length);if(!error)return false;
  let source=error,params={name:file.name};
  if(photos.length+extras.length>=20)source=error;
  else if(!file.size)source='"{name}" está vacío y no se puede subir.';
  else if(file.size>50*1024*1024)source='"{name}" pesa más de 50 MB y no se puede subir.';
  else source=kind==='photo'?'"{name}" no tiene un formato compatible. Use JPG, PNG, WebP o HEIC.':'"{name}" no tiene un formato compatible. Use MP4 o MOV.';
  showError(source);setText($('#err'),source,params);return true;
}
function addPhotos(list){
  for(const file of list){
    if(rejectFile(file,'photo'))continue;
    if(photos.some(p=>p.file.name===file.name&&p.file.size===file.size))continue;
    photos.push({file,url:URL.createObjectURL(file),caption:''});
  }
  renderPhotos();
}
function addExtras(list){
  for(const file of list){
    if(rejectFile(file,'video'))continue;
    if(extras.some(x=>x.name===file.name&&x.size===file.size))continue;
    extras.push(file);
  }
  renderExtras();
}
function renderPhotos(){
  const host=$('#thumbs');if(!host)return;
  host.innerHTML=photos.map((p,i)=>`<div class="thumb"><img src="${p.url}" alt="${esc(t('Foto {number}',{number:i+1}))}" data-i18n-alt="Foto {number}" data-i18n-params="${esc(JSON.stringify({number:i+1}))}"><div class="tb"><span class="num">${i+1}</span><button type="button" data-up="${i}" aria-label="${esc(t('Mover foto {number} antes',{number:i+1}))}" data-i18n-aria-label="Mover foto {number} antes" data-i18n-params="${esc(JSON.stringify({number:i+1}))}"${i?'':' disabled'}>${icon('up')}</button><button type="button" data-down="${i}" aria-label="${esc(t('Mover foto {number} después',{number:i+1}))}" data-i18n-aria-label="Mover foto {number} después" data-i18n-params="${esc(JSON.stringify({number:i+1}))}"${i===photos.length-1?' disabled':''}>${icon('down')}</button><button type="button" class="rm" data-rm="${i}" aria-label="${esc(t('Quitar foto {number}',{number:i+1}))}" data-i18n-aria-label="Quitar foto {number}" data-i18n-params="${esc(JSON.stringify({number:i+1}))}">${icon('remove')}</button></div><input class="cap" data-cap="${i}" aria-label="${esc(t('Descripción de la foto {number}',{number:i+1}))}" data-i18n-aria-label="Descripción de la foto {number}" data-i18n-params="${esc(JSON.stringify({number:i+1}))}" placeholder="${esc(t('¿Qué momento es?'))}" data-i18n-placeholder="¿Qué momento es?" value="${esc(p.caption)}"></div>`).join('');
  const mb=photos.reduce((n,p)=>n+p.file.size,0)/1048576;
  setText($('#photoCount'),photos.length?(photos.length===1?'{count} foto · {mb} MB':'{count} fotos · {mb} MB'):'Sin fotos todavía',{count:photos.length,mb:mb.toFixed(1)});
  $$('[data-up]',host).forEach(b=>b.onclick=()=>move(+b.dataset.up,-1));
  $$('[data-down]',host).forEach(b=>b.onclick=()=>move(+b.dataset.down,1));
  $$('[data-rm]',host).forEach(b=>b.onclick=()=>{const i=+b.dataset.rm;URL.revokeObjectURL(photos[i].url);photos.splice(i,1);renderPhotos();const next=host.querySelector(`[data-rm="${Math.min(i,photos.length-1)}"]`);(next||$('#photoInput')).focus()});
  $$('[data-cap]',host).forEach(inp=>inp.oninput=()=>{photos[+inp.dataset.cap].caption=inp.value});
}
function move(i,d){const j=i+d;if(j<0||j>=photos.length)return;[photos[i],photos[j]]=[photos[j],photos[i]];renderPhotos();$('#thumbs').querySelector(`[data-${d<0?'up':'down'}="${j}"]`)?.focus()}
function renderExtras(){
  const host=$('#extraFiles');if(!host)return;
  host.innerHTML=extras.map((x,i)=>`<div class="file">${esc(x.name)} · ${(x.size/1048576).toFixed(1)} MB <button type="button" class="btn ghost" data-xrm="${i}" style="float:right;padding:4px 9px">${localized('Quitar')}</button></div>`).join('');
  $$('[data-xrm]',host).forEach(b=>b.onclick=()=>{extras.splice(+b.dataset.xrm,1);renderExtras()});
}
const slideshowSummary=()=>photos.map((p,i)=>`${i+1}. ${p.file.name}${p.caption?` — ${p.caption}`:''}`).join('\n');

/* ---------- wizard ---------- */
function formDataObject(){const d={};new FormData(f).forEach((v,k)=>d[k]=v);return d}
function save(msg=false){if(!tid)return;if(msg)draftEnabled=true;if(!draftEnabled)return;try{localStorage.setItem(storageKey(tid),JSON.stringify(formDataObject()));if(msg)showError('Borrador guardado en este dispositivo. Puede borrarlo cuando quiera.',false)}catch{showError('Este navegador no pudo guardar el borrador. Mantenga la página abierta.')}}
$('#clearDraft').onclick=()=>{if(tid)try{localStorage.removeItem(storageKey(tid));}catch{}draftEnabled=false;showError('El borrador guardado se borró. Sus respuestas actuales siguen aquí.',false)};
function restore(){try{const d=JSON.parse(localStorage.getItem(storageKey(tid))||'{}');Object.entries(d).forEach(([k,v])=>$$(`[name="${CSS.escape(k)}"]`).forEach(n=>{if(['radio','checkbox'].includes(n.type))n.checked=n.value===v;else n.value=v}))}catch{}}
function enumAnswer(key,value){if(key==='Paquete'&&['songs','slideshow'].includes(value))return localized(value==='songs'?'Dos canciones + letras · $20 USD':'Dos canciones + letras + video · $50 USD');const field=T.steps.flatMap(step=>step.f).find(field=>field.n===key&&field.t==='radio');return field?.o.includes(value)?localized(value):esc(value)}
function review(){
  const d=formDataObject();
  const rows=Object.entries(d).filter(([k,v])=>k!=='Confirmación'&&String(v).trim()).map(([k,v])=>`<div class="row"><b>${localized(k)}</b><span>${enumAnswer(k,v)}</span></div>`).join('');
  const pics=photos.length?`<div class="row"><b>${localized('Fotos para el slideshow ({count})',{count:photos.length})}</b><span>${esc(slideshowSummary())}</span></div>`:'';
  const vids=extras.length?`<div class="row"><b>${localized('Videos de referencia')}</b><span>${esc(extras.map(x=>x.name).join(', '))}</span></div>`:'';
  $('#review').innerHTML=`<div class="row"><b>${localized('Tipo de canción')}</b><span>${localized(T.name)}</span></div>`+rows+pics+vids;
}
function ui(){
  const nodes=$$('.step',$('#stepHost'));
  nodes.forEach((s,i)=>s.classList.toggle('active',i===cur));
  const p=Math.round((cur+1)/steps.length*100);
  setText($('#sl'),'Paso {current} de {total}',{current:cur+1,total:steps.length});$('#pc').textContent=p+'%';$('#bar').style.width=p+'%';
  $('.track').setAttribute('aria-valuenow',p);
  nodes[cur]?.querySelector('h2')?.focus({preventScroll:true});
  animateStep(nodes[cur]);

  $('#back').style.visibility=cur?'visible':'hidden';
  $('#next').classList.toggle('hidden',cur===steps.length-1);
  $('#submit').classList.toggle('hidden',cur!==steps.length-1);
  $('#err').classList.remove('show');
  if(cur===steps.length-1)review();
  scrollTo({top:0,behavior:scrollBehavior()});
}
function showError(msg,isError=true){const e=$('#err');setText(e,msg);e.style.background=isError?'#fff1f1':'#e9f5ed';e.style.color=isError?'#9f2f2f':'#267044';e.classList.add('show')}
function valid(){for(const n of $$('.step',$('#stepHost'))[cur].querySelectorAll('input,textarea')){if(n.name&&!n.checkValidity()){showError('Revise los campos obligatorios antes de continuar.');n.focus();return false}}return true}
$('#next').onclick=()=>{if(valid()){save();cur++;ui()}};
$('#back').onclick=()=>{if(cur){cur--;ui()}};
$('#save').onclick=()=>save(true);
f.addEventListener('input',()=>save());

/* ---------- submit ---------- */
async function callIntake(body){if(PREVIEW_MODE)throw new Error('Vista previa: no se envían solicitudes ni archivos.');const res=await fetch(EDGE_URL,{method:'POST',headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY},body:JSON.stringify(body)});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||'No se pudo enviar la solicitud.');return data}
f.onsubmit=async e=>{
  e.preventDefault();if(!valid())return;
  const submit=$('#submit');setText(submit,'Enviando…');f.classList.add('submitting');
  try{
    const a=formDataObject();
    a['Tipo de canción']=T.name;
    if(photos.length)a['Fotos para el slideshow']=slideshowSummary();
    const m=T.meta(a);
    const upload=[...photos.map(p=>p.file),...extras];
    const fileMeta=upload.map(x=>({name:x.name,size:x.size,type:x.type}));
    const created=pendingSubmission?.created||await callIntake({action:'submit',website:'',order_type:'personalized_song',
      title:m.title||`Canción personalizada · ${T.name}`,
      customer_name:a['Persona que realiza el pedido'],customer_email:a['Correo electrónico'],customer_phone:a['Teléfono'],
      event_date:a['Fecha del evento']||null,
      couple_names:m.subject||null,anniversary_date:m.date||null,years_married:m.years||null,
      language:a['Idioma']||null,
      music_style:(a['Estilo musical']==='Otro'?a['Otro estilo']:a['Estilo musical'])||a['Otro estilo']||null,
      emotion:a['Emoción']||null,answers:{...a,'Paquete elegido':selectedPlan==='slideshow'?'Canciones + video · $50 USD':'Canciones + letras · $20 USD'},files:fileMeta});
    if(!pendingSubmission){pendingSubmission={created,upload,manifest:[],plan:selectedPlan,photos:photos.map(p=>({caption:p.caption}))};
      $$('input,textarea',f).forEach(n=>n.disabled=true);$('#back').disabled=true;$('#save').disabled=true;}
    if(created.uploads.length!==pendingSubmission.upload.length)throw Object.assign(new Error('El servidor no aceptó todos los archivos. No se confirmó la solicitud. Conserve este número para consultar: {number}'),{i18nParams:{number:created.order_number}});
    const manifest=pendingSubmission.manifest;
    for(let i=manifest.length;i<created.uploads.length;i++){
      const u=created.uploads[i],file=pendingSubmission.upload[i],isPhoto=i<pendingSubmission.photos.length;
      const {error}=await supabase.storage.from('shia-song-uploads').uploadToSignedUrl(u.path,u.token,file,{contentType:file.type});
      if(error)throw error;
      manifest.push({name:file.name,path:u.path,type:file.type,size:file.size,role:isPhoto?'slideshow':'referencia',order:isPhoto?i+1:null,caption:isPhoto?pendingSubmission.photos[i].caption:''});
    }
    const finalize=fm=>callIntake({action:'finalize',order_id:created.order_id,submission_token:created.submission_token,file_manifest:fm});
    const final=await finalize(manifest);
    await paymentUI.setOrder({orderId:created.order_id,token:final.payment_token,packageKey:pendingSubmission.plan});
    pendingSubmission=null;
    try{localStorage.removeItem(storageKey(tid));}catch{}
    setText($('#doneMessage'),'Su número de solicitud es #{number}. Guárdelo para referencia.',{number:final.order_number});
    $('#done').showModal();
    $$('input,textarea',f).forEach(n=>n.disabled=false);$('#back').disabled=false;$('#save').disabled=false;f.reset();resetPhotos();cur=0;ui();
  }catch(err){const source=Object.hasOwn(TRANSLATIONS,err.message)?err.message:'Ocurrió un error al enviar.';showError(source);const errorHost=$('#err');errorHost.removeAttribute('data-i18n');errorHost.innerHTML=localized(source,err.i18nParams||{})+(pendingSubmission?' '+localized('Conserve el número de solicitud {number}. No cree una segunda solicitud si ya se envió; reintentar solo continúa esta solicitud.',{number:pendingSubmission.created.order_number||pendingSubmission.created.order_id}):'')}
  finally{setText(submit,'Enviar formulario');f.classList.remove('submitting')}
};
$('#close').onclick=()=>$('#done').close();

/* ---------- admin ---------- */
function switchView(admin){$('#customerApp').classList.toggle('hidden',admin);$('#adminApp').classList.toggle('hidden',!admin);$('#showForm').classList.toggle('active',!admin);$('#showAdmin').classList.toggle('active',admin);if(admin)checkAdminSession()}
function goHome(){if(pendingSubmission||f.classList.contains('submitting'))return showError('Hay una solicitud pendiente de confirmar. Termine o reintente este envío antes de volver al inicio.');switchView(false);$('#formArea').classList.add('hidden');$('#picker').classList.remove('hidden');scrollTo({top:0,behavior:scrollBehavior()})}
$('#brandHome').onclick=e=>{e.preventDefault();goHome()};$('#footerAdmin').onclick=()=>switchView(true);
$('#showForm').onclick=()=>{switchView(false);if(!tid)$('#ocasiones').scrollIntoView({behavior:scrollBehavior()})};$('#showAdmin').onclick=()=>switchView(true);if(location.hash==='#admin')switchView(true);
$('#typeFilter').innerHTML='<option value="">Todos los tipos</option>'+TEMPLATE_ORDER.map(id=>`<option value="${esc(TEMPLATES[id].name)}">${esc(TEMPLATES[id].name)}</option>`).join('');
function authError(msg){const e=$('#authError');e.textContent=msg;e.classList.add('show')}
$('#loginForm').onsubmit=async e=>{e.preventDefault();if(PREVIEW_MODE)return authError('Vista previa: el acceso administrativo está desactivado.');$('#authError').classList.remove('show');const {error}=await supabase.auth.signInWithPassword({email:$('#adminEmail').value,password:$('#adminPassword').value});if(error)return authError(error.message);await checkAdminSession()};
async function checkAdminSession(){if(PREVIEW_MODE){$('#adminAuth').classList.remove('hidden');$('#adminPanel').classList.add('hidden');return}const {data:{user}}=await supabase.auth.getUser();if(!user){$('#adminAuth').classList.remove('hidden');$('#adminPanel').classList.add('hidden');return}let {data:membership}=await supabase.from('shia_admins').select('role').eq('user_id',user.id).maybeSingle();if(!membership){await supabase.auth.signOut();return authError('Esta cuenta no está autorizada para administrar solicitudes.')}$('#adminAuth').classList.add('hidden');$('#adminPanel').classList.remove('hidden');await loadOrders()}
$('#logoutBtn').onclick=async()=>{await supabase.auth.signOut();checkAdminSession()};$('#refreshOrders').onclick=loadOrders;$('#searchOrders').oninput=renderOrders;$('#statusFilter').onchange=renderOrders;$('#typeFilter').onchange=renderOrders;
async function loadOrders(){const {data,error}=await supabase.from('shia_song_orders').select('*').order('created_at',{ascending:false});if(error){$('#ordersList').innerHTML=`<div class="error show">${esc(error.message)}</div>`;return}orders=data||[];renderStats();renderOrders()}
function renderStats(){const counts={new:0,active:0,completed:0,total:orders.length};orders.forEach(o=>{if(o.status==='new')counts.new++;if(['reviewing','lyrics_in_progress','waiting_on_customer','song_in_progress'].includes(o.status))counts.active++;if(['completed','delivered'].includes(o.status))counts.completed++});$('#stats').innerHTML=[['Total',counts.total],['Nuevas',counts.new],['En proceso',counts.active],['Completadas',counts.completed]].map(([k,v])=>`<div class="stat"><span>${k}</span><b>${v}</b></div>`).join('')}
const labels={new:'Nueva',reviewing:'En revisión',lyrics_in_progress:'Letra en progreso',waiting_on_customer:'Esperando cliente',song_in_progress:'Canción en progreso',completed:'Completada',delivered:'Entregada',cancelled:'Cancelada'};
const orderType=o=>(o.answers||{})['Tipo de canción']||'Aniversario de bodas';
function slideshowFiles(o){const list=(o.file_manifest||[]).filter(x=>x.role?x.role==='slideshow':/^image\//.test(x.type||''));return list.slice().sort((a,b)=>(a.order??0)-(b.order??0))}
function renderOrders(){
  const q=$('#searchOrders').value.toLowerCase(),sf=$('#statusFilter').value,tf=$('#typeFilter').value;
  const list=orders.filter(o=>(!sf||o.status===sf)&&(!tf||orderType(o)===tf)&&(!q||`${o.order_number} ${o.customer_name} ${o.customer_email} ${o.couple_names||''}`.toLowerCase().includes(q)));
  $('#ordersList').innerHTML=list.length?list.map(orderCard).join(''):'<div class="order-card">No hay solicitudes que coincidan.</div>';
  $$('[data-save]').forEach(b=>b.onclick=()=>saveOrder(b.dataset.save));
  $$('[data-file]').forEach(a=>a.onclick=e=>openFile(e,a.dataset.file));
  $$('[data-gallery]').forEach(b=>b.onclick=()=>showGallery(b.dataset.gallery));
}
function orderCard(o){
  const answers=Object.entries(o.answers||{}).filter(([k,v])=>k!=='Confirmación'&&String(v??'').trim()).map(([k,v])=>`<div class="answer"><b>${esc(k)}</b>${esc(v)}</div>`).join('');
  const opts=Object.entries(labels).map(([v,l])=>`<option value="${v}" ${o.status===v?'selected':''}>${l}</option>`).join('');
  const fileLinks=(o.file_manifest||[]).map(x=>`<a href="#" class="filelink" data-file="${esc(x.path)}">${esc(x.name)}</a>`).join('');
  const pics=slideshowFiles(o);
  const gallery=pics.length?`<h4>Slideshow · ${pics.length} ${pics.length===1?'foto':'fotos'}</h4><button class="btn secondary" data-gallery="${o.id}">Ver fotos en orden</button><div class="gallery" id="gal-${o.id}"></div>`:'';
  return `<article class="order-card"><div class="order-top"><div><h3>#${o.order_number} · ${esc(o.title||o.couple_names||'Canción personalizada')}</h3><div class="order-meta"><span class="badge">${esc(orderType(o))}</span> ${esc(o.customer_name)} · ${esc(o.customer_email)} · ${esc(o.customer_phone)} · ${new Date(o.created_at).toLocaleString()}</div></div><select id="status-${o.id}">${opts}</select></div><div class="order-grid"><div><h4>Respuestas</h4><div class="answer-list">${answers||'<div class="answer">Sin respuestas.</div>'}</div>${gallery}${fileLinks?`<h4>Archivos privados</h4><div class="file-links">${fileLinks}</div>`:''}</div><div><h4>Notas internas</h4><textarea class="notes" id="notes-${o.id}" placeholder="Ideas para la letra, seguimiento, cambios…">${esc(o.internal_notes||'')}</textarea><div class="save-row"><button class="btn primary" data-save="${o.id}">Guardar cambios</button></div></div></div></article>`;
}
async function showGallery(id){
  const o=orders.find(x=>x.id===id),host=$(`#gal-${id}`);if(!o||!host)return;
  host.innerHTML='<p>Cargando fotos…</p>';
  const pics=slideshowFiles(o);
  const signed=await Promise.all(pics.map(async(x,i)=>{const {data}=await supabase.storage.from('shia-song-uploads').createSignedUrl(x.path,3600);return{...x,url:data?.signedUrl,i}}));
  host.innerHTML=signed.map(x=>x.url?`<figure><a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer"><img src="${esc(x.url)}" alt="${esc(x.name)}"></a><figcaption><b>${x.order??x.i+1}.</b> ${esc(x.caption||x.name)}</figcaption></figure>`:'').join('')||'<p>No se pudieron cargar las fotos.</p>';
}
async function saveOrder(id){const status=$(`#status-${id}`).value,internal_notes=$(`#notes-${id}`).value;const {error}=await supabase.from('shia_song_orders').update({status,internal_notes}).eq('id',id);if(error)return alert(error.message);const o=orders.find(x=>x.id===id);if(o){o.status=status;o.internal_notes=internal_notes}renderStats();alert('Cambios guardados.')}
async function openFile(e,path){e.preventDefault();const {data,error}=await supabase.storage.from('shia-song-uploads').createSignedUrl(path,300);if(error)return alert(error.message);window.open(data.signedUrl,'_blank','noopener,noreferrer')}

$('#adminApp').setAttribute('lang','es');
applyTranslations();
