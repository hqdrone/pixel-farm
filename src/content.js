// Учебный контент. Новая тема = запись в TOPICS + слова в ITEMS, логику трогать не нужно.
// Элемент: {id, topic, en, ru, sprite, color?}. Буквы: ещё letter, ex (слово-пример), exRu.
// id слов не менять: по ним хранится прогресс детей (profile.words[id]).
// Спрайт каждого нового слова проверить глазами: node tools/sprite-sheet.js → tools/sprite-sheet.html
const TOPICS = [
  {id:'letters', ru:'Буквы',    en:'Letters', icon:'apple'},
  {id:'animals', ru:'Животные', en:'Animals', icon:'cat'},
  {id:'food',    ru:'Еда',      en:'Food',    icon:'cheese'},
  {id:'colors',  ru:'Цвета',    en:'Colors',  icon:'ball', color:'#2ba6e8'},
  {id:'numbers', ru:'Числа',    en:'Numbers', icon:'n3'},
  {id:'toys',    ru:'Игрушки',  en:'Toys',    icon:'teddy'},
  {id:'clothes', ru:'Одежда',   en:'Clothes', icon:'shirt'},
  {id:'weather', ru:'Погода',   en:'Weather', icon:'sun'},
];

const LETTER_WORDS = [
  ['A','apple','яблоко','apple'], ['B','banana','банан','banana'], ['C','cat','кошка','cat'], ['D','dog','собака','dog'],
  ['E','egg','яйцо','egg'], ['F','fish','рыба','fish'], ['G','grapes','виноград','grapes'], ['H','hat','шляпа','hat'],
  ['I','ice cream','мороженое','icecream'], ['J','juice','сок','juice'], ['K','kite','воздушный змей','kite'], ['L','lion','лев','lion'],
  ['M','moon','луна','moon'], ['N','nest','гнездо','nest'], ['O','octopus','осьминог','octopus'], ['P','pig','свинья','pig'],
  ['Q','queen','королева','queen'], ['R','rabbit','кролик','rabbit'], ['S','sun','солнце','sun'], ['T','tree','дерево','tree'],
  ['U','umbrella','зонтик','umbrella'], ['V','volcano','вулкан','volcano'], ['W','watermelon','арбуз','watermelon'],
  ['X','xylophone','ксилофон','xylophone'], ['Y','yo-yo','йо-йо','yoyo'], ['Z','zebra','зебра','zebra'],
];

const ITEMS = [
  ...LETTER_WORDS.map(([L, ex, exRu, sprite]) => ({id:'L-'+L, topic:'letters', en:L, ru:'буква '+L, letter:L, ex, exRu, sprite})),

  {id:'cat',topic:'animals',en:'cat',ru:'кошка',sprite:'cat'},
  {id:'dog',topic:'animals',en:'dog',ru:'собака',sprite:'dog'},
  {id:'cow',topic:'animals',en:'cow',ru:'корова',sprite:'cow'},
  {id:'pig',topic:'animals',en:'pig',ru:'свинья',sprite:'pig'},
  {id:'duck',topic:'animals',en:'duck',ru:'утка',sprite:'duck'},
  {id:'fish',topic:'animals',en:'fish',ru:'рыба',sprite:'fish'},
  {id:'frog',topic:'animals',en:'frog',ru:'лягушка',sprite:'frog'},
  {id:'rabbit',topic:'animals',en:'rabbit',ru:'кролик',sprite:'rabbit'},

  {id:'apple',topic:'food',en:'apple',ru:'яблоко',sprite:'apple'},
  {id:'banana',topic:'food',en:'banana',ru:'банан',sprite:'banana'},
  {id:'carrot',topic:'food',en:'carrot',ru:'морковь',sprite:'carrot'},
  {id:'egg',topic:'food',en:'egg',ru:'яйцо',sprite:'egg'},
  {id:'bread',topic:'food',en:'bread',ru:'хлеб',sprite:'bread'},
  {id:'cheese',topic:'food',en:'cheese',ru:'сыр',sprite:'cheese'},
  {id:'milk',topic:'food',en:'milk',ru:'молоко',sprite:'milk'},
  {id:'cake',topic:'food',en:'cake',ru:'торт',sprite:'cake'},

  {id:'red',topic:'colors',en:'red',ru:'красный',sprite:'ball',color:'#e43b44'},
  {id:'blue',topic:'colors',en:'blue',ru:'синий',sprite:'ball',color:'#2463d6'},
  {id:'green',topic:'colors',en:'green',ru:'зелёный',sprite:'ball',color:'#3fae3f'},
  {id:'yellow',topic:'colors',en:'yellow',ru:'жёлтый',sprite:'ball',color:'#fee761'},
  {id:'orange',topic:'colors',en:'orange',ru:'оранжевый',sprite:'ball',color:'#f77622'},
  {id:'pink',topic:'colors',en:'pink',ru:'розовый',sprite:'ball',color:'#ff8fc0'},
  {id:'black',topic:'colors',en:'black',ru:'чёрный',sprite:'ball',color:'#3a3a48'},
  {id:'white',topic:'colors',en:'white',ru:'белый',sprite:'ball',color:'#ffffff'},

  ...['one','two','three','four','five','six','seven','eight','nine','ten'].map((en, i) => ({
    id:'num-'+(i+1), topic:'numbers', en, ru:['один','два','три','четыре','пять','шесть','семь','восемь','девять','десять'][i]+' · '+(i+1), sprite:'n'+(i+1), num:i+1})),

  {id:'toy-ball',topic:'toys',en:'ball',ru:'мяч',sprite:'beachball'},
  {id:'doll',topic:'toys',en:'doll',ru:'кукла',sprite:'doll'},
  {id:'car',topic:'toys',en:'car',ru:'машинка',sprite:'car'},
  {id:'robot',topic:'toys',en:'robot',ru:'робот',sprite:'robot'},
  {id:'kite',topic:'toys',en:'kite',ru:'воздушный змей',sprite:'kite'},
  {id:'teddy',topic:'toys',en:'teddy',ru:'мишка',sprite:'teddy'},
  {id:'drum',topic:'toys',en:'drum',ru:'барабан',sprite:'drum'},
  {id:'boat',topic:'toys',en:'boat',ru:'кораблик',sprite:'boat'},

  {id:'hat',topic:'clothes',en:'hat',ru:'шляпа',sprite:'hat'},
  {id:'shirt',topic:'clothes',en:'shirt',ru:'футболка',sprite:'shirt'},
  {id:'dress',topic:'clothes',en:'dress',ru:'платье',sprite:'dress'},
  {id:'pants',topic:'clothes',en:'pants',ru:'штаны',sprite:'pants'},
  {id:'shoes',topic:'clothes',en:'shoes',ru:'кроссовки',sprite:'shoes'},
  {id:'socks',topic:'clothes',en:'socks',ru:'носки',sprite:'socks'},
  {id:'coat',topic:'clothes',en:'coat',ru:'пальто',sprite:'coat'},
  {id:'gloves',topic:'clothes',en:'gloves',ru:'перчатки',sprite:'gloves'},

  {id:'sun',topic:'weather',en:'sun',ru:'солнце',sprite:'sun'},
  {id:'moon',topic:'weather',en:'moon',ru:'луна',sprite:'moon'},
  {id:'star',topic:'weather',en:'star',ru:'звезда',sprite:'star'},
  {id:'cloud',topic:'weather',en:'cloud',ru:'облако',sprite:'cloud'},
  {id:'rain',topic:'weather',en:'rain',ru:'дождь',sprite:'rain'},
  {id:'snow',topic:'weather',en:'snow',ru:'снег',sprite:'snow'},
  {id:'rainbow',topic:'weather',en:'rainbow',ru:'радуга',sprite:'rainbow'},
  {id:'umbrella',topic:'weather',en:'umbrella',ru:'зонтик',sprite:'umbrella'},
];
if (typeof module !== 'undefined') module.exports = {TOPICS, ITEMS};
