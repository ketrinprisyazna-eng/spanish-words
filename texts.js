// Короткие тексты на испанском (с переводом), составленные преимущественно
// из слов текущего словаря пользователя. Переключаются ES <-> RU в интерфейсе.
// Проверка "известных слов" делается на лету в app.js по словарю WORDS_DATA.
const TEXTS_DATA = [
  {
    title: "Мой день",
    theme: "Повседневность",
    es: "Normalmente me levanto temprano, a las siete y media. Primero me ducho y me visto. Desayuno pan con mantequilla y un café con leche. Después voy al trabajo en autobús. Por la tarde regreso a casa y ceno con mi familia. Por la noche veo la televisión o leo un libro. Siempre me acuesto tarde.",
    ru: "Обычно я встаю рано, в половине восьмого. Сначала принимаю душ и одеваюсь. Завтракаю хлебом с маслом и кофе с молоком. Потом еду на работу на автобусе. Днём возвращаюсь домой и ужинаю с семьёй. По вечерам смотрю телевизор или читаю книгу. Я всегда ложусь спать поздно."
  },
  {
    title: "Моя семья",
    theme: "Семья",
    es: "Mi familia es pequeña pero muy unida. Mi padre es ingeniero y mi madre es profesora. Tengo un hermano y una hermana. Mi hermano es alto y muy inteligente. Mi hermana es simpática y siempre está de buen humor. También tengo un perro que se llama Rocky. Todos los domingos comemos juntos en casa de mis abuelos.",
    ru: "Моя семья маленькая, но очень дружная. Мой отец — инженер, а мама — учительница. У меня есть брат и сестра. Мой брат высокий и очень умный. Моя сестра приятная и всегда в хорошем настроении. У меня также есть собака по имени Рокки. Каждое воскресенье мы едим вместе у бабушки с дедушкой."
  },
  {
    title: "Погода и одежда",
    theme: "Погода",
    es: "Hoy hace mucho frío y hace viento. En invierno necesito un abrigo, una bufanda y guantes. En verano, cuando hace calor y hace sol, prefiero llevar una camiseta y sandalias. Cuando llueve, uso un paraguas. Mi color favorito es el azul, y casi toda mi ropa es azul o negra.",
    ru: "Сегодня очень холодно и ветрено. Зимой мне нужны пальто, шарф и перчатки. Летом, когда жарко и солнечно, я предпочитаю футболку и сандалии. Когда идёт дождь, я пользуюсь зонтом. Мой любимый цвет — синий, и почти вся моя одежда синяя или чёрная."
  },
  {
    title: "В ресторане",
    theme: "Еда",
    es: "Esta noche voy a un restaurante con mi mejor amiga. Tengo mucha hambre. De primero quiero una ensalada, y de segundo prefiero pollo con arroz. Mi amiga quiere pescado con verduras. Para beber, quiero agua con hielo, y ella quiere un jugo de naranja. De postre, compartimos un pastel de chocolate. ¡La comida está deliciosa!",
    ru: "Сегодня вечером я иду в ресторан с лучшей подругой. Я очень голодна. На первое хочу салат, а на второе предпочитаю курицу с рисом. Моя подруга хочет рыбу с овощами. Пить хочу воду со льдом, а она хочет апельсиновый сок. На десерт мы делим шоколадный торт. Еда очень вкусная!"
  },
  {
    title: "Прогулка по городу",
    theme: "Город",
    es: "Mi ciudad no es muy grande, pero es muy bonita. En el centro hay una plaza, una iglesia y muchas tiendas. Cerca de mi casa hay un parque donde camino todos los días. Para ir al trabajo, tomo el metro o el autobús. Los fines de semana me gusta ir al cine o a un café con amigos. A veces vamos al museo también.",
    ru: "Мой город не очень большой, но очень красивый. В центре есть площадь, церковь и много магазинов. Рядом с моим домом есть парк, где я гуляю каждый день. Чтобы добраться до работы, я езжу на метро или автобусе. По выходным мне нравится ходить в кино или в кафе с друзьями. Иногда мы ходим и в музей."
  },
  {
    title: "Спорт и хобби",
    theme: "Хобби",
    es: "En mi tiempo libre me gusta practicar deporte. Los lunes y miércoles voy al gimnasio, y los sábados juego al fútbol con mis amigos. También me gusta nadar en la piscina y montar en bicicleta cuando hace buen tiempo. Por las noches prefiero escuchar música o tocar la guitarra. Mi hermano prefiere los videojuegos, pero a mí no me interesan mucho.",
    ru: "В свободное время мне нравится заниматься спортом. По понедельникам и средам я хожу в спортзал, а по субботам играю в футбол с друзьями. Мне также нравится плавать в бассейне и кататься на велосипеде, когда хорошая погода. По вечерам я предпочитаю слушать музыку или играть на гитаре. Мой брат предпочитает видеоигры, но меня они не очень интересуют."
  },
  {
    title: "Отпуск на пляже",
    theme: "Путешествия",
    es: "El próximo mes voy de vacaciones a la playa con mi familia. Vamos a viajar en avión y vamos a quedarnos en un hotel cerca del mar. Quiero nadar, tomar el sol y comer pescado fresco todos los días. Mi madre quiere visitar un pueblo pequeño y comprar souvenirs. Estoy muy emocionada porque me encanta el verano y la playa.",
    ru: "В следующем месяце я еду в отпуск на пляж с семьёй. Мы полетим на самолёте и остановимся в отеле рядом с морем. Я хочу плавать, загорать и есть свежую рыбу каждый день. Моя мама хочет посетить маленькую деревню и купить сувениры. Я очень взволнована, потому что обожаю лето и пляж."
  },
  {
    title: "У врача",
    theme: "Здоровье",
    es: "Hoy no me siento bien. Me duele la cabeza y también me duele el estómago. Tengo un poco de fiebre y tos. Voy a ir a la clínica para hablar con el doctor. Creo que necesito medicina y mucho descanso. Mi madre dice que también necesito beber mucha agua y dormir temprano.",
    ru: "Сегодня я плохо себя чувствую. У меня болит голова, а также болит живот. У меня небольшая температура и кашель. Я пойду в клинику поговорить с врачом. Думаю, мне нужны лекарства и много отдыха. Мама говорит, что мне также нужно пить много воды и рано ложиться спать."
  },
  {
    title: "Мой дом",
    theme: "Дом",
    es: "Vivo en un apartamento pequeño en el centro de la ciudad. Tiene una cocina, un baño, un dormitorio y una sala. Mi habitación favorita es la cocina porque me gusta cocinar. En la sala tengo un sofá, una mesa y muchos libros. No tengo jardín, pero tengo una terraza pequeña con plantas. Los fines de semana limpio la casa y lavo la ropa.",
    ru: "Я живу в маленькой квартире в центре города. В ней есть кухня, ванная, спальня и гостиная. Моя любимая комната — кухня, потому что мне нравится готовить. В гостиной у меня есть диван, стол и много книг. У меня нет сада, но есть маленькая терраса с растениями. По выходным я убираюсь дома и стираю одежду."
  },
  {
    title: "Знакомство",
    theme: "Разговор",
    es: "¡Hola! ¿Cómo estás? Me llamo Ana, soy de España y soy profesora. Tengo veinticinco años. ¿Y tú, cómo te llamas? ¿De dónde eres? Mucho gusto en conocerte. Si quieres, podemos tomar un café mañana y hablar más. ¡Hasta luego!",
    ru: "Привет! Как дела? Меня зовут Анна, я из Испании, я учительница. Мне двадцать пять лет. А ты, как тебя зовут? Откуда ты? Очень приятно познакомиться. Если хочешь, можем завтра выпить кофе и поговорить ещё. До скорого!"
  }
];
