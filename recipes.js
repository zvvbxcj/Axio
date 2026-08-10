window.recipesDB = window.recipesDB || [
    // --- ЗАВТРАКИ ---
    {
        id: 101, 
        category: "breakfast",
        taste: ",", 
        time: "15 min", 
        difficulty: {ru:"Легко", en:"Easy"},
        name: { ru: "Сытный Омлет с томатами", en: "Hearty Omelette" },
        description: {
            ru: "Идеальный завтрак для энергичного начала дня. Сочные томаты и тягучий сыр делают этот омлет невероятно вкусным.",
            en: "Perfect breakfast for an energetic start. Juicy tomatoes and melted cheese make this omelette incredibly tasty."
        },
        images: ["https://images.unsplash.com/photo-1510693206972-df098062cb71?w=800"],
        ingredients: [
            { name: "Яйцо куриное С0", amount: 3, unit: "шт" },
            { name: "Молоко 3.2%", amount: 50, unit: "мл" },
            { name: "Сыр пармезан", amount: 30, unit: "г" },
            { name: "Помидор", amount: 1, unit: "шт" },
            { name: "Масло сливочное", amount: 10, unit: "г" }
        ],
        steps: { 
            ru: [
                "Подготовьте ингредиенты: помойте томат, натрите сыр на мелкой терке.",
                "В глубокую миску разбейте 3 яйца, влейте молоко, добавьте щепотку соли. Взбейте венчиком до появления легкой пены.",
                "Нарежьте помидор небольшими кубиками.",
                "Разогрейте сковороду на среднем огне, растопите сливочное масло, распределив его по всей поверхности.",
                "Вылейте яичную смесь на сковороду. Как только низ схватится (через 1-2 минуты), выложите сверху томаты и посыпьте сыром.",
                "Накройте крышкой, убавьте огонь до минимума и готовьте еще 3-4 минуты, пока сыр не расплавится."
            ],
            en: ["Whisk eggs and milk.", "Dice tomato.", "Melt butter on pan.", "Pour eggs, add toppings.", "Cook covered for 4 mins."]
        }
    },
    {
        id: 102, 
        category: "breakfast",
        taste: ",", 
        time: "10 min", 
        difficulty: {ru:"Легко", en:"Easy"},
        name: { ru: "Овсянка с бананом и медом", en: "Banana Oatmeal" },
        description: {
            ru: "Классическая каша, богатая клетчаткой. Банан добавляет сладость, а мед — приятный аромат.",
            en: "Classic fiber-rich porridge. Banana adds sweetness and honey gives a nice aroma."
        },
        images: ["https://images.unsplash.com/photo-1517673400267-0251440c45dc?w=800"],
        ingredients: [
            { name: "Овсяные хлопья", amount: 50, unit: "г" },
            { name: "Молоко 3.2%", amount: 200, unit: "мл" },
            { name: "Банан", amount: 1, unit: "шт" },
            { name: "Мед", amount: 15, unit: "г" }
        ],
        steps: { 
            ru: [
                "Влейте молоко в небольшую кастрюлю и доведите до кипения на среднем огне.",
                "Всыпьте овсяные хлопья, убавьте огонь и варите, постоянно помешивая, 5-7 минут.",
                "Пока варится каша, очистите банан и нарежьте его кружочками.",
                "Снимите кашу с огня, дайте постоять под крышкой 2 минуты.",
                "Выложите в глубокую тарелку, украсьте ломтиками банана и полейте медом перед подачей."
            ],
            en: ["Boil milk.", "Add oats and cook for 5-7 mins.", "Slice banana.", "Serve porridge topped with banana and honey."]
        }
    },
    {
        id: 103, 
        category: "breakfast",
        taste: ",", 
        time: "30 min", 
        difficulty: {ru:"Средне", en:"Medium"},
        name: { ru: "Нежные Сырники", en: "Cheese Pancakes" },
        description: {
            ru: "Золотистые, пышные сырники с хрустящей корочкой и нежной серединкой. Лучший выбор для выходного дня.",
            en: "Golden, fluffy cheese pancakes with a crispy crust. Best choice for the weekend."
        },
        images: ["https://images.unsplash.com/photo-1543508182-009da137e89a?w=800"],
        ingredients: [
            { name: "Творог", amount: 400, unit: "г" },
            { name: "Яйцо куриное С0", amount: 1, unit: "шт" },
            { name: "Мука пшеничная", amount: 50, unit: "г" },
            { name: "Сахар", amount: 30, unit: "г" },
            { name: "Масло растительное", amount: 20, unit: "мл" }
        ],
        steps: { 
            ru: [
                "Творог протрите через сито или хорошо разомните вилкой, чтобы не было крупных комков.",
                "Добавьте яйцо и сахар, тщательно перемешайте.",
                "Всыпьте муку и замесите мягкое тесто. Оно может немного липнуть к рукам.",
                "Сформируйте небольшие шарики, обваляйте их в муке и приплюсните, формируя 'шайбочки'.",
                "Разогрейте масло на сковороде. Обжаривайте сырники на среднем огне по 4-5 минут с каждой стороны до румяной корочки."
            ],
            en: ["Mash cottage cheese.", "Mix with egg and sugar.", "Add flour.", "Form patties.", "Fry until golden."]
        }
    },

    // --- СУПЫ ---
    {
        id: 201, 
        category: "soup",
        taste: ",", 
        time: "90 min", 
        difficulty: {ru:"Средне", en:"Medium"},
        name: { ru: "Борщ Домашний", en: "Classic Borscht" },
        description: {
            ru: "Наваристый, густой и ароматный суп насыщенного красного цвета. Главное блюдо славянской кухни.",
            en: "Rich, thick and aromatic soup of deep red color. The main dish of Slavic cuisine."
        },
        images: ["https://images.unsplash.com/photo-1550950158-d0d960dff51b?w=800"],
        ingredients: [
            { name: "Говядина", amount: 500, unit: "г" },
            { name: "Свекла", amount: 2, unit: "шт" },
            { name: "Картофель", amount: 3, unit: "шт" },
            { name: "Капуста", amount: 250, unit: "г" },
            { name: "Морковь", amount: 1, unit: "шт" },
            { name: "Лук репчатый", amount: 1, unit: "шт" },
            { name: "Сметана", amount: 50, unit: "г" }
        ],
        steps: { 
            ru: [
                "Мясо промойте, залейте холодной водой и варите бульон 60 минут, снимая пену.",
                "Нашинкуйте капусту соломкой, картофель нарежьте брусочками.",
                "Сделайте зажарку: лук нарежьте кубиками, морковь и свеклу натрите. Обжарьте овощи на масле 10 минут, добавив немного бульона.",
                "В кипящий бульон добавьте картофель и капусту. Варите 15 минут.",
                "Добавьте зажарку, лавровый лист и соль. Варите еще 10 минут на медленном огне.",
                "Подавайте горячим со сметаной и зеленью."
            ],
            en: ["Boil beef for broth.", "Chop veggies.", "Fry beets, carrots, onion.", "Add veggies to broth.", "Simmer until done."]
        }
    },
    {
        id: 202, 
        category: "soup", 
        taste: ",",
        time: "35 min", 
        difficulty: {ru:"Легко", en:"Easy"},
        name: { ru: "Крем-суп из тыквы", en: "Pumpkin Cream Soup" },
        description: {
            ru: "Бархатистый, согревающий суп с нежной текстурой и ярким оранжевым цветом.",
            en: "Velvety, warming soup with a delicate texture and bright orange color."
        },
        images: ["https://images.unsplash.com/photo-1476718406336-bb5a9690ee2a?w=800"],
        ingredients: [
            { name: "Тыква", amount: 600, unit: "г" },
            { name: "Сливки 20%", amount: 150, unit: "мл" },
            { name: "Лук репчатый", amount: 1, unit: "шт" },
            { name: "Чеснок", amount: 1, unit: "зуб" },
            { name: "Масло сливочное", amount: 20, unit: "г" }
        ],
        steps: { 
            ru: [
                "Тыкву очистите от кожуры и семян, нарежьте крупными кубиками. Лук нарежьте мелко.",
                "В кастрюле с толстым дном растопите масло, обжарьте лук и чеснок до прозрачности.",
                "Добавьте тыкву, залейте водой так, чтобы она едва покрывала овощи. Тушите до мягкости (около 20 мин).",
                "Слейте часть воды, пробейте овощи блендером до состояния пюре.",
                "Влейте теплые сливки, перемешайте и прогрейте суп еще 2-3 минуты, не доводя до кипения."
            ],
            en: ["Chop pumpkin and onion.", "Fry onion/garlic.", "Stew pumpkin.", "Blend.", "Add cream."]
        }
    },

    // --- ПАСТА ---
    {
        id: 301, 
        category: "pasta",
        taste: ",", 
        time: "20 min", 
        difficulty: {ru:"Легко", en:"Easy"},
        name: { ru: "Паста Карбонара", en: "Pasta Carbonara" },
        description: {
            ru: "Легендарная римская паста. Никаких сливок — только желтки, сыр, перец и гуанчиале (или бекон).",
            en: "Legendary Roman pasta. No cream — just yolks, cheese, pepper and bacon."
        },
        images: ["https://images.unsplash.com/photo-1612874742237-6526221588e3?w=800"],
        ingredients: [
            { name: "Паста спагетти", amount: 200, unit: "г" },
            { name: "Бекон", amount: 100, unit: "г" },
            { name: "Яйцо куриное С0", amount: 3, unit: "шт" },
            { name: "Сыр пармезан", amount: 60, unit: "г" },
            { name: "Чеснок", amount: 1, unit: "зуб" },
            { name: "Перец черный", amount: 2, unit: "г" }
        ],
        steps: { 
            ru: [
                "Поставьте кипятиться воду для пасты (не забудьте посолить).",
                "Нарежьте бекон полосками. Чеснок просто раздавите ножом.",
                "Обжарьте бекон с чесноком на сковороде до золотистости. Чеснок затем выкиньте.",
                "В миске смешайте 1 яйцо и 2 желтка с тертым сыром и перцем.",
                "Сварите спагетти al dente. Переложите их горячими в сковороду к бекону (снимите с огня!).",
                "Влейте яичную смесь и интенсивно мешайте, чтобы получился кремовый соус."
            ],
            en: ["Boil pasta.", "Fry bacon.", "Mix eggs and cheese.", "Combine pasta with bacon.", "Add egg mix off heat."]
        }
    },
    {
        id: 302, 
        category: "pasta",
        taste: ",", 
        time: "25 min", 
        difficulty: {ru:"Средне", en:"Medium"},
        name: { ru: "Фетучини с грибами", en: "Mushroom Fettuccine" },
        description: {
            ru: "Сливочная паста с ароматом жареных грибов. Простое, но изысканное блюдо.",
            en: "Creamy pasta with the aroma of fried mushrooms. Simple but exquisite."
        },
        images: ["https://images.unsplash.com/photo-1556761223-4c4282c73f77?w=800"],
        ingredients: [
            { name: "Паста фетучини", amount: 250, unit: "г" },
            { name: "Шампиньоны", amount: 200, unit: "г" },
            { name: "Сливки 20%", amount: 150, unit: "мл" },
            { name: "Лук репчатый", amount: 1, unit: "шт" },
            { name: "Сыр пармезан", amount: 30, unit: "г" }
        ],
        steps: { 
            ru: [
                "Поставьте вариться пасту.",
                "Нарежьте грибы пластинками, а лук — мелкими кубиками.",
                "На сковороде обжарьте лук, затем добавьте грибы. Жарьте, пока не испарится вся влага.",
                "Влейте сливки, посолите и тушите соус 5 минут до легкого загустения.",
                "Добавьте готовую пасту в соус, перемешайте и посыпьте сыром."
            ],
            en: ["Boil pasta.", "Fry mushrooms and onion.", "Add cream and simmer.", "Mix with pasta."]
        }
    },

    // --- ОСНОВНЫЕ БЛЮДА ---
    {
        id: 401, 
        category: "main",
        taste: ",", 
        time: "40 min", 
        difficulty: {ru:"Средне", en:"Medium"},
        name: { ru: "Курица Терияки с рисом", en: "Teriyaki Chicken" },
        description: {
            ru: "Кусочки курицы в сладковато-соленом японском соусе. Подается с рисом и брокколи.",
            en: "Chicken pieces in sweet and salty Japanese sauce. Served with rice and broccoli."
        },
        images: ["https://images.unsplash.com/photo-1529854140021-a5313fde5044?w=800"],
        ingredients: [
            { name: "Куриное филе", amount: 500, unit: "г" },
            { name: "Соус Терияки", amount: 100, unit: "мл" },
            { name: "Рис", amount: 200, unit: "г" },
            { name: "Кунжут", amount: 5, unit: "г" },
            { name: "Брокколи", amount: 150, unit: "г" }
        ],
        steps: { 
            ru: [
                "Отварите рис согласно инструкции на упаковке.",
                "Куриное филе нарежьте средними кусочками. Брокколи разберите на соцветия (можно отварить 3 минуты).",
                "Разогрейте сковороду, обжарьте курицу на сильном огне до золотистой корочки (около 7 мин).",
                "Убавьте огонь, влейте соус Терияки. Тушите, помешивая, пока соус не загустеет и не покроет каждый кусочек (3-5 мин).",
                "Подавайте рис, сверху курицу и брокколи. Посыпьте кунжутом."
            ],
            en: ["Boil rice.", "Fry chicken pieces.", "Add Teriyaki sauce and simmer.", "Serve with rice and broccoli."]
        }
    },
    {
        id: 402, 
        category: "main",
        taste: ",", 
        time: "45 min", 
        difficulty: {ru:"Средне", en:"Medium"},
        name: { ru: "Запеченный Лосось с картофелем", en: "Baked Salmon" },
        description: {
            ru: "Полезный ужин, приготовленный в духовке. Рыба получается сочной, а картофель ароматным.",
            en: "Healthy oven-baked dinner. The fish turns out juicy and potatoes aromatic."
        },
        images: ["https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800"],
        ingredients: [
            { name: "Филе лосося", amount: 400, unit: "г" },
            { name: "Лимон", amount: 0.5, unit: "шт" },
            { name: "Масло оливковое", amount: 20, unit: "мл" },
            { name: "Розмарин", amount: 2, unit: "г" },
            { name: "Картофель", amount: 300, unit: "г" }
        ],
        steps: { 
            ru: [
                "Разогрейте духовку до 180°C.",
                "Картофель помойте (можно не чистить) и нарежьте дольками. Смешайте с маслом и солью.",
                "Выложите картофель на противень и запекайте 20 минут.",
                "Достаньте противень, сдвиньте картофель и положите рядом рыбу.",
                "Полейте рыбу лимонным соком, маслом, положите веточку розмарина.",
                "Верните в духовку еще на 15 минут до готовности рыбы."
            ],
            en: ["Bake potatoes for 20 mins.", "Add salmon to tray.", "Season fish.", "Bake everything for 15 more mins."]
        }
    },
    {
        id: 403, 
        category: "main",
        taste: ",", 
        time: "40 min", 
        difficulty: {ru:"Легко", en:"Easy"},
        name: { ru: "Сочные котлеты из индейки", en: "Turkey Cutlets" },
        description: {
            ru: "Диетические, но очень сочные котлеты. Секрет в добавлении размоченного хлеба и лука.",
            en: "Dietary but very juicy cutlets. The secret is adding soaked bread and onions."
        },
        images: ["https://images.unsplash.com/photo-1529692236671-f1f6e940a926?w=800"],
        ingredients: [
            { name: "Фарш индейки", amount: 500, unit: "г" },
            { name: "Лук репчатый", amount: 1, unit: "шт" },
            { name: "Яйцо куриное С0", amount: 1, unit: "шт" },
            { name: "Хлеб", amount: 50, unit: "г" },
            { name: "Молоко 3.2%", amount: 50, unit: "мл" }
        ],
        steps: { 
            ru: [
                "Хлеб (лучше черствый) замочите в молоке на 5 минут, затем отожмите.",
                "Лук измельчите в блендере или очень мелко нарежьте.",
                "В большой миске смешайте фарш, лук, яйцо и размоченный хлеб. Посолите и поперчите.",
                "Хорошо отбейте фарш (бросайте его в миску несколько раз) — так котлеты не развалятся.",
                "Сформируйте котлеты влажными руками.",
                "Обжаривайте на среднем огне по 6-7 минут с каждой стороны."
            ],
            en: ["Soak bread.", "Mix meat, onion, egg, bread.", "Form cutlets.", "Fry 6-7 mins per side."]
        }
    },

    // --- САЛАТЫ ---
    {
        id: 501, 
        category: "salad",
        taste: ",", 
        time: "15 min", 
        difficulty: {ru:"Легко", en:"Easy"},
        name: { ru: "Греческий Салат", en: "Greek Salad" },
        description: {
            ru: "Свежий овощной салат с соленой фетой и оливками. Заправляется оливковым маслом и орегано.",
            en: "Fresh vegetable salad with salty feta and olives. Dressed with olive oil and oregano."
        },
        images: ["https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800"],
        ingredients: [
            { name: "Помидор", amount: 2, unit: "шт" },
            { name: "Огурцы", amount: 2, unit: "шт" },
            { name: "Перец болгарский", amount: 1, unit: "шт" },
            { name: "Сыр Фета", amount: 100, unit: "г" },
            { name: "Оливки", amount: 50, unit: "г" },
            { name: "Масло оливковое", amount: 30, unit: "мл" }
        ],
        steps: { 
            ru: [
                "Все овощи помойте и обсушите.",
                "Нарежьте помидоры, огурцы и перец крупными кубиками (примерно 2х2 см).",
                "Выложите овощи в салатник, добавьте оливки (целые или половинками).",
                "Сыр Фета нарежьте кубиками и аккуратно выложите сверху.",
                "Щедро полейте оливковым маслом и посыпьте сушеным орегано. Не перемешивайте до подачи."
            ],
            en: ["Chop veggies coarsely.", "Add olives.", "Top with feta cubes.", "Drizzle oil and oregano."]
        }
    },
    {
        id: 502, 
        category: "salad",
        taste: ",", 
        time: "25 min", 
        difficulty: {ru:"Средне", en:"Medium"},
        name: { ru: "Салат Цезарь с курицей", en: "Caesar Salad" },
        description: {
            ru: "Популярный салат с хрустящими листьями, сухариками и фирменным соусом.",
            en: "Popular salad with crispy leaves, croutons and signature sauce."
        },
        images: ["https://images.unsplash.com/photo-1550304943-4f24f54ddde9?w=800"],
        ingredients: [
            { name: "Куриное филе", amount: 200, unit: "г" },
            { name: "Салат Айсберг", amount: 150, unit: "г" },
            { name: "Помидоры черри", amount: 100, unit: "г" },
            { name: "Сыр пармезан", amount: 30, unit: "г" },
            { name: "Сухарики", amount: 50, unit: "г" }
        ],
        steps: { 
            ru: [
                "Куриное филе посолите и обжарьте на сковороде до готовности. Нарежьте ломтиками.",
                "Салат Айсберг порвите руками на крупные куски (не режьте ножом).",
                "Помидоры черри разрежьте пополам.",
                "На тарелку выложите листья салата, полейте соусом Цезарь.",
                "Сверху выложите курицу, черри и сухарики.",
                "Посыпьте тертым пармезаном."
            ],
            en: ["Cook and slice chicken.", "Tear lettuce.", "Assemble salad with sauce and croutons."]
        }
    },

    // 10. НАПИТКИ (DRINKS)
    // ===========================
    {
        id: 1001, category: "drinks", time: "5 min", difficulty: {ru:"Легко", en:"Easy"},
        name: { ru: "Мохито (б/а)", en: "Virgin Mojito" },
        description: { ru: "Освежающий напиток с мятой и лаймом.", en: "Refreshing drink with mint and lime." },
        images: ["https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=800"],
        ingredients: [
            { name: "Газировка (Спрайт)", amount: 200, unit: "мл" }, { name: "Лайм", amount: 0.5, unit: "шт" },
            { name: "Мята", amount: 10, unit: "г" }, { name: "Лед", amount: 100, unit: "г" }
        ],
        steps: { ru: ["Разомните лайм и мяту в стакане.", "Засыпьте лед.", "Залейте газировкой."], en: ["Muddle lime/mint.", "Add ice.", "Pour soda."] }
    },
    {
        id: 1002, category: "drinks", time: "10 min", difficulty: {ru:"Легко", en:"Easy"},
        name: { ru: "Смузи ягодный", en: "Berry Smoothie" },
        description: { ru: "Густой витаминный коктейль.", en: "Thick vitamin cocktail." },
        images: ["https://images.unsplash.com/photo-1553530666-ba11a90654f3?w=800"],
        ingredients: [
            { name: "Ягоды (любые)", amount: 100, unit: "г" }, { name: "Банан", amount: 1, unit: "шт" },
            { name: "Йогурт", amount: 100, unit: "мл" }
        ],
        steps: { ru: ["Взбейте все ингредиенты в блендере."], en: ["Blend everything."] }
    },
    {
        id: 1003, category: "drinks", time: "15 min", difficulty: {ru:"Легко", en:"Easy"},
        name: { ru: "Глинтвейн (б/а)", en: "Mulled Juice" },
        description: { ru: "Горячий пряный сок для холодных вечеров.", en: "Hot spicy juice for cold nights." },
        images: ["https://images.unsplash.com/photo-1512103869905-546536098d5f?w=800"],
        ingredients: [
            { name: "Сок вишневый", amount: 500, unit: "мл" }, { name: "Апельсин", amount: 0.5, unit: "шт" },
            { name: "Корица", amount: 1, unit: "палочка" }, { name: "Гвоздика", amount: 3, unit: "шт" }
        ],
        steps: { ru: ["Нагрейте сок со специями и фруктами.", "Не доводите до кипения.", "Дайте настояться."], en: ["Heat juice with spices.", "Don't boil.", "Steep."] }
    },
    {
        id: 1004, category: "drinks", time: "5 min", difficulty: {ru:"Легко", en:"Easy"},
        name: { ru: "Домашний лимонад", en: "Lemonade" },
        description: { ru: "Классический лимонад из лимонов.", en: "Classic lemonade." },
        images: ["https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=800"], // placeholder
        ingredients: [
            { name: "Лимон", amount: 2, unit: "шт" }, { name: "Сахар", amount: 50, unit: "г" },
            { name: "Вода газированная", amount: 1, unit: "л" }, { name: "Лед", amount: 200, unit: "г" }
        ],
        steps: { ru: ["Выжмите сок из лимонов.", "Смешайте с сахаром.", "Разбавьте водой и добавьте лед."], en: ["Squeeze lemons.", "Mix with sugar.", "Add water/ice."] }
    },
    {
        id: 1005, category: "drinks", time: "5 min", difficulty: {ru:"Легко", en:"Easy"},
        name: { ru: "Латте", en: "Latte" },
        description: { ru: "Кофе с большим количеством молока.", en: "Coffee with lots of milk." },
        images: ["https://images.unsplash.com/photo-1541167760496-1628856ab772?w=800"],
        ingredients: [
            { name: "Кофе эспрессо", amount: 30, unit: "мл" }, { name: "Молоко", amount: 150, unit: "мл" },
            { name: "Сахар", amount: 5, unit: "г" }
        ],
        steps: { ru: ["Сварите кофе.", "Взбейте горячее молоко в пену.", "Влейте молоко в кофе."], en: ["Brew coffee.", "Froth milk.", "Combine."] }
    },

    // 8. ЗАКУСКИ (SNACKS)
    {
        id: 901, category: "snacks", time: "10 min", difficulty: {ru:"Легко", en:"Easy"},
        name: { ru: "Брускетта с томатами", en: "Tomato Bruschetta" },
        description: { ru: "Хрустящий багет с томатной сальсой.", en: "Crispy baguette with tomato salsa." },
        images: ["https://images.unsplash.com/photo-1572695157363-bc31c5d4ef52?w=800"],
        ingredients: [
            { name: "Багет", amount: 0.5, unit: "шт" }, { name: "Помидор", amount: 2, unit: "шт" },
            { name: "Чеснок", amount: 1, unit: "зуб" }, { name: "Базилик", amount: 10, unit: "г" }
        ],
        steps: { ru: ["Подсушите ломтики хлеба.", "Нарежьте томаты кубиком, смешайте с маслом и базиликом.", "Выложите на хлеб."], en: ["Toast bread.", "Mix tomato salsa.", "Serve on bread."] }
    },
    {
        id: 902, category: "snacks", time: "15 min", difficulty: {ru:"Легко", en:"Easy"},
        name: { ru: "Гуакамоле", en: "Guacamole" },
        description: { ru: "Мексиканский соус из авокадо с чипсами.", en: "Mexican avocado dip with chips." },
        images: ["https://images.unsplash.com/photo-1604543666838-8a8e3d047e12?w=800"],
        ingredients: [
            { name: "Авокадо", amount: 2, unit: "шт" }, { name: "Лайм", amount: 0.5, unit: "шт" },
            { name: "Помидор", amount: 1, unit: "шт" }, { name: "Начос", amount: 100, unit: "г" }
        ],
        steps: { ru: ["Разомните авокадо вилкой.", "Добавьте сок лайма и нарезанный томат.", "Подавайте с чипсами."], en: ["Mash avocado.", "Mix in lime/tomato.", "Serve with chips."] }
    },
    {
        id: 903, category: "snacks", time: "20 min", difficulty: {ru:"Легко", en:"Easy"},
        name: { ru: "Гренки с чесноком", en: "Garlic Bread" },
        description: { ru: "Ароматные гренки к пиву или супу.", en: "Aromatic toasts for beer or soup." },
        images: ["https://images.unsplash.com/photo-1573140247632-f84660f67627?w=800"], // placeholder
        ingredients: [
            { name: "Хлеб бородинский", amount: 400, unit: "г" }, { name: "Чеснок", amount: 3, unit: "зуб" },
            { name: "Масло растительное", amount: 50, unit: "мл" }
        ],
        steps: { ru: ["Нарежьте хлеб брусочками.", "Обжарьте в масле.", "Натрите чесноком и посолите."], en: ["Cut bread.", "Fry.", "Rub with garlic."] }
    },
    {
        id: 904, category: "snacks", time: "30 min", difficulty: {ru:"Средне", en:"Medium"},
        name: { ru: "Фаршированные яйца", en: "Deviled Eggs" },
        description: { ru: "Классическая закуска для праздничного стола.", en: "Classic festive snack." },
        images: ["https://images.unsplash.com/photo-1594220551065-27a3788a1011?w=800"],
        ingredients: [
            { name: "Яйцо", amount: 5, unit: "шт" }, { name: "Майонез", amount: 30, unit: "г" },
            { name: "Горчица", amount: 5, unit: "г" }
        ],
        steps: { ru: ["Сварите яйца вкрутую.", "Разрежьте, выньте желтки.", "Смешайте желтки с соусами.", "Наполните белки."], en: ["Boil eggs.", "Mix yolks with sauce.", "Fill whites."] }
    },
    {
        id: 905, category: "snacks", time: "10 min", difficulty: {ru:"Легко", en:"Easy"},
        name: { ru: "Канапе с сыром", en: "Cheese Canapes" },
        description: { ru: "Быстрая закуска на шпажках.", en: "Quick skewers snack." },
        images: ["https://images.unsplash.com/photo-1549488352-257a965f9ec3?w=800"], // generic food
        ingredients: [
            { name: "Сыр твердый", amount: 100, unit: "г" }, { name: "Виноград", amount: 100, unit: "г" },
            { name: "Крекеры", amount: 50, unit: "г" }
        ],
        steps: { ru: ["Нарежьте сыр кубиками.", "Наколите на шпажку сыр и виноградину."], en: ["Cube cheese.", "Skewer with grapes."] }
    },

    // 7. ВЫПЕЧКА (BAKING)
    // ===========================
    {
        id: 801, category: "baking", time: "60 min", difficulty: {ru:"Средне", en:"Medium"},
        name: { ru: "Шарлотка", en: "Apple Pie" },
        description: { ru: "Простой и вкусный пирог с яблоками.", en: "Simple and tasty apple pie." },
        images: ["https://images.unsplash.com/photo-1568571780765-9276227b6ce5?w=800"],
        ingredients: [
            { name: "Яблоки", amount: 3, unit: "шт" }, { name: "Мука", amount: 160, unit: "г" },
            { name: "Сахар", amount: 160, unit: "г" }, { name: "Яйцо", amount: 4, unit: "шт" }
        ],
        steps: { ru: ["Взбейте яйца с сахаром в пышную пену.", "Аккуратно введите муку.", "Яблоки нарежьте, залейте тестом.", "Пеките 40 мин при 180°C."], en: ["Whisk eggs/sugar.", "Fold in flour.", "Add apples.", "Bake."] }
    },
    {
        id: 802, category: "baking", time: "40 min", difficulty: {ru:"Легко", en:"Easy"},
        name: { ru: "Пицца Маргарита", en: "Pizza Margherita" },
        description: { ru: "Домашняя пицца с томатами и сыром.", en: "Homemade pizza with tomatoes and cheese." },
        images: ["https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=800"],
        ingredients: [
            { name: "Тесто дрожжевое", amount: 300, unit: "г" }, { name: "Томатный соус", amount: 50, unit: "г" },
            { name: "Моцарелла", amount: 150, unit: "г" }, { name: "Базилик", amount: 5, unit: "г" }
        ],
        steps: { ru: ["Раскатайте тесто.", "Смажьте соусом.", "Выложите сыр.", "Пеките 15 мин при 220°C."], en: ["Roll dough.", "Add sauce.", "Add cheese.", "Bake."] }
    },
    {
        id: 803, category: "baking", time: "25 min", difficulty: {ru:"Легко", en:"Easy"},
        name: { ru: "Печенье с шоколадом", en: "Chocolate Chip Cookies" },
        description: { ru: "Американское печенье с кусочками шоколада.", en: "American cookies with chocolate chips." },
        images: ["https://images.unsplash.com/photo-1499636138143-bd630f5cf386?w=800"],
        ingredients: [
            { name: "Мука", amount: 200, unit: "г" }, { name: "Масло сливочное", amount: 100, unit: "г" },
            { name: "Сахар", amount: 100, unit: "г" }, { name: "Шоколад", amount: 50, unit: "г" }
        ],
        steps: { ru: ["Смешайте масло с сахаром.", "Добавьте муку и шоколад.", "Сформируйте шарики.", "Пеките 12 мин при 180°C."], en: ["Cream butter/sugar.", "Add flour/choco.", "Bake."] }
    },
    {
        id: 804, category: "baking", time: "50 min", difficulty: {ru:"Средне", en:"Medium"},
        name: { ru: "Фокачча", en: "Focaccia" },
        description: { ru: "Итальянский хлеб с розмарином.", en: "Italian bread with rosemary." },
        images: ["https://images.unsplash.com/photo-1573140247632-f84660f67627?w=800"],
        ingredients: [
            { name: "Мука", amount: 500, unit: "г" }, { name: "Дрожжи", amount: 7, unit: "г" },
            { name: "Вода", amount: 300, unit: "мл" }, { name: "Масло оливковое", amount: 50, unit: "мл" }
        ],
        steps: { ru: ["Замесите тесто, дайте подойти 1 час.", "Растяните на противне, сделайте ямки пальцами.", "Полейте маслом.", "Пеките 25 мин."], en: ["Make dough.", "Rise.", "Dimple and oil.", "Bake."] }
    },
    {
        id: 805, category: "baking", time: "45 min", difficulty: {ru:"Средне", en:"Medium"},
        name: { ru: "Сосиски в тесте", en: "Pigs in a Blanket" },
        description: { ru: "Любимая выпечка из детства.", en: "Childhood favorite pastry." },
        images: ["https://images.unsplash.com/photo-1627308595229-7830a5c91f9f?w=800"],
        ingredients: [
            { name: "Тесто слоеное", amount: 400, unit: "г" }, { name: "Сосиски", amount: 8, unit: "шт" },
            { name: "Яйцо", amount: 1, unit: "шт" }
        ],
        steps: { ru: ["Нарежьте тесто полосками.", "Оберните сосиски.", "Смажьте яйцом.", "Пеките 20 мин при 200°C."], en: ["Slice dough.", "Wrap sausages.", "Egg wash.", "Bake."] }
    },

    // --- ВЕГЕТАРИАНСКОЕ ---
    {
        id: 601, 
        category: "veg",
        taste: ",", 
        time: "15 min", 
        difficulty: {ru:"Легко", en:"Easy"},
        name: { ru: "Тост с авокадо и яйцом", en: "Avocado Toast" },
        description: {
            ru: "Модный и полезный перекус. Кремовое авокадо отлично сочетается с хрустящим хлебом.",
            en: "Trendy and healthy snack. Creamy avocado pairs perfectly with crispy bread."
        },
        images: ["https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800"],
        ingredients: [
            { name: "Хлеб", amount: 2, unit: "ломтик" },
            { name: "Авокадо", amount: 1, unit: "шт" },
            { name: "Яйцо куриное С0", amount: 2, unit: "шт" },
            { name: "Лимон", amount: 0.2, unit: "шт" }
        ],
        steps: { 
            ru: [
                "Авокадо разрежьте, удалите косточку. Мякоть разомните вилкой в миске.",
                "Добавьте к авокадо соль, перец и сок лимона (чтобы не почернело).",
                "Хлеб подсушите в тостере или на сухой сковороде.",
                "Пожарьте яйца (глазунью) или сварите яйца-пашот.",
                "Намажьте пасту из авокадо на хлеб, сверху аккуратно выложите яйцо."
            ],
            en: ["Mash avocado with lemon.", "Toast bread.", "Cook eggs.", "Assemble toast."]
        }
    },
    {
        id: 602, 
        category: "veg",
        taste: ",", 
        time: "40 min", 
        difficulty: {ru:"Легко", en:"Easy"},
        name: { ru: "Рататуй по-домашнему", en: "Simple Ratatouille" },
        description: {
            ru: "Красочное овощное рагу из Прованса. Вкусно как в горячем, так и в холодном виде.",
            en: "Colorful vegetable stew from Provence. Tasty both hot and cold."
        },
        images: ["https://images.unsplash.com/photo-1572453800999-e8d2d1589b7c?w=800"],
        ingredients: [
            { name: "Баклажан", amount: 1, unit: "шт" },
            { name: "Кабачок", amount: 1, unit: "шт" },
            { name: "Помидор", amount: 3, unit: "шт" },
            { name: "Чеснок", amount: 2, unit: "зуб" },
            { name: "Масло оливковое", amount: 30, unit: "мл" }
        ],
        steps: { 
            ru: [
                "Разогрейте духовку до 200°C.",
                "Все овощи (баклажан, кабачок, помидоры) нарежьте тонкими кружочками одинаковой толщины.",
                "В форму для запекания выкладывайте овощи ребром, чередуя их: баклажан-помидор-кабачок.",
                "Смешайте масло с измельченным чесноком и травами. Полейте овощи.",
                "Накройте фольгой и запекайте 30 минут, затем снимите фольгу и пеките еще 10 минут."
            ],
            en: ["Slice veggies.", "Arrange in dish.", "Season with garlic oil.", "Bake covered then uncovered."]
        }
    },

    // --- ДЕСЕРТЫ ---
    {
        id: 701, 
        category: "dessert",
        taste: ",", 
        time: "50 min", 
        difficulty: {ru:"Средне", en:"Medium"},
        name: { ru: "Банановый хлеб (Кекс)", en: "Banana Bread" },
        description: {
            ru: "Влажный, сладкий кекс с насыщенным банановым вкусом. Идеальный способ использовать переспелые бананы.",
            en: "Moist, sweet cake with rich banana flavor. Perfect use for overripe bananas."
        },
        images: ["https://images.unsplash.com/photo-1551024601-bec78aea704b?w=800"],
        ingredients: [
            { name: "Банан", amount: 3, unit: "шт" },
            { name: "Мука пшеничная", amount: 200, unit: "г" },
            { name: "Масло сливочное", amount: 100, unit: "г" },
            { name: "Сахар", amount: 100, unit: "г" },
            { name: "Яйцо куриное С0", amount: 2, unit: "шт" }
        ],
        steps: { 
            ru: [
                "Разогрейте духовку до 180°C. Форму смажьте маслом.",
                "Бананы разомните вилкой в пюре (чем чернее бананы, тем лучше).",
                "Влейте растопленное сливочное масло к бананам, добавьте сахар и яйца. Взбейте вилкой.",
                "Постепенно всыпьте муку (и разрыхлитель, если есть). Перемешайте, но не долго.",
                "Вылейте тесто в форму и выпекайте 40-50 минут. Проверяйте готовность зубочисткой."
            ],
            en: ["Mash bananas.", "Mix with butter, sugar, eggs.", "Add flour.", "Bake at 180°C for 45 mins."]
        }
    }
];