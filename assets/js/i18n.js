import { STATIC_TRANSLATIONS } from './static-translations.js';
import { QUESTIONNAIRE_TRANSLATIONS } from './questionnaire-translations.js';
export const TRANSLATIONS = {...STATIC_TRANSLATIONS,...QUESTIONNAIRE_TRANSLATIONS};
const localeKey='shia-ui-language';
let language='en';
try { if(localStorage.getItem(localeKey)==='es')language='es'; } catch {/* Storage is optional. */}
export const getLanguage=()=>language;
export function t(source,params={}){
  const value=language==='en'?(TRANSLATIONS[source]??source):source;
  return String(value).replace(/\{(\w+)\}/g,(match,key)=>Object.hasOwn(params,key)?String(params[key]):match);
}
export function applyTranslations(root=document){
  const elements=[...(root.nodeType===1?[root]:[]),...root.querySelectorAll('[data-i18n],[data-i18n-aria-label],[data-i18n-title],[data-i18n-placeholder],[data-i18n-alt]')];
  for(const element of elements){
    let params={};try{params=JSON.parse(element.dataset.i18nParams||'{}')}catch{}
    if(element.hasAttribute('data-i18n'))element.textContent=t(element.dataset.i18n,params);
    for(const attr of ['aria-label','title','placeholder','alt'])if(element.hasAttribute(`data-i18n-${attr}`))element.setAttribute(attr,t(element.getAttribute(`data-i18n-${attr}`),params));
  }
  document.documentElement.lang=language;
  document.querySelectorAll('[data-language]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.language===language)));
}
export function setLanguage(locale){
  if(!['en','es'].includes(locale))return;
  language=locale;try{localStorage.setItem(localeKey,locale)}catch{}
  applyTranslations();
  window.dispatchEvent(new CustomEvent('shia:languagechange',{detail:{language}}));
}
window.ShiaI18n={t,getLanguage,setLanguage,applyTranslations};
document.querySelectorAll('[data-language]').forEach(button=>button.addEventListener('click',()=>setLanguage(button.dataset.language)));
applyTranslations();
