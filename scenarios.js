// Scenarios data for StroyOps-Bot demo
// 3 cases × 3 styles × 2 languages
window.STROYOPS_SCENARIOS = {
  ru: [
    {
      id: 'case1',
      label: 'Кейс 1 · КОР · колодец К-12',
      tag: 'КОР',
      transcript: 'Так, по К-12... короче, у нас тут засада. Смотрю по чертежу — колодец полторашка, тысяча пятьсот. А приходит у нас три трубы: магистраль тысячная, и две сбоку — шестисотая и четырёхсотая. Они в полторашку физически не лезут, угол примыкания не выдерживается, лоток не разводится. Нужна двухтысячная, минимум. У меня монтажники стоят, кольца лежат привезённые — полторашка, как в РД. По уму — надо письмо в АэроКомпозит, чтобы корректировку выдали и смету пересчитали, потому что разница в кольцах копеечная не получится. Сегодня же, иначе завтра у меня бригада простаивает, экскаватор тоже. Ну и СД, конечно, чтобы потом КС-2 закрыли без проблем.',
      duration: '0:45',
      header: {
        number: '№ 148/26.00',
        date: '09 апреля 2026 г.',
        to: 'АО «ТехноСтрой-Альфа»',
        attn: 'Иванову А. Н., зам. ген. директора — директору филиала в г. Ульяновск',
        subject: 'КОР · корректировка РД 22.041.1-ИНЖ-НВК.1, узел 3 (колодец К-12). Несоответствие диаметра колодца габаритам присоединяемых трубопроводов'
      },
      letters: {
        official: `Уважаемый Александр Николаевич!

В соответствии с Договором подряда № 161-24 от 31.07.2024 г., в ходе подготовки к производству работ по устройству наружных сетей водоотведения на объекте «Е10-Е1» Подрядчиком проведён анализ рабочей документации шифр 22.041.1-ИНЖ-НВК.1, лист 14, узел 3 (колодец К-12).

Установлено следующее. Согласно листу 14 указанного раздела, колодец К-12 предусмотрен сборным железобетонным, внутренним диаметром 1500 мм. При этом в данный колодец проектом запроектировано присоединение трёх трубопроводов: магистрального Ду1000 мм, а также подключающих Ду600 мм и Ду400 мм. Геометрическая проверка узла по СП 32.13330.2018 (п. 6.3.4) показала, что компоновка трёх присоединений в колодце Ø1500 мм нарушает минимально допустимые осевые расстояния между присоединениями. Минимальный внутренний диаметр колодца должен составлять 2000 мм.

Руководствуясь п. 3.5 Договора и ст. 743 ГК РФ, просим:
1. Обеспечить выдачу скорректированной РД шифр 22.041.1-ИНЖ-НВК.1 (узел 3 листа 14) с заменой К-12 на Ø2000 мм.
2. Обеспечить выдачу скорректированной сметной документации с учётом изменения позиций ФЕР 23-03-002-04.
3. До получения откорректированной РД и СД работы по устройству колодца К-12 считать приостановленными.

Срок ожидаемого ответа — 3 рабочих дня. В случае задержки выдачи документации Подрядчик будет вынужден руководствоваться ст. 716 и ст. 719 ГК РФ с фиксацией простоя.

Приложения:
1. Графическая схема предлагаемого узла К-12 (Ø2000) — 1 л.
2. Расчёт-обоснование по СП 32.13330.2018 — 1 л.
3. Фотофиксация привезённых ж/б колец Ø1500 — 1 л.

С уважением,
Лавров Д. А., зам. директора по производству ООО «СтройПроект-Регион»`,
        soft: `Уважаемый Александр Николаевич!

При подготовке к монтажу узла К-12 выявлено несоответствие: по РД колодец Ø1500, фактически в него заводятся три трубопровода (Ду1000 + Ду600 + Ду400), что нарушает п. 6.3.4 СП 32.13330.2018. Требуется типоразмер Ø2000.

Предлагаю совместно рассмотреть вариант замены колодца на Ø2000 мм. В течение 3 рабочих дней будем признательны за выдачу корректировки РД 22.041.1-ИНЖ-НВК.1 (л. 14, узел 3) и пересчитанной СД. До выдачи документации работы на узле приостановлены (ст. 716 ГК РФ).

Готовы обсудить детали на рабочем совещании в удобное для Вас время.

С уважением,
Лавров Д. А.`,
        hard: `Уважаемый Александр Николаевич!

Настоящим фиксируем: рабочая документация 22.041.1-ИНЖ-НВК.1 (лист 14, узел 3) содержит неустранимое несоответствие — колодец К-12 запроектирован Ø1500 мм при необходимости присоединения трёх трубопроводов Ду1000/600/400, что прямо нарушает п. 6.3.4 СП 32.13330.2018 и делает узел физически нереализуемым.

С 09.04.2026 г. работы по устройству К-12 и сопрягаемых участков сетей водоотведения приостановлены на основании ст. 716, 719 ГК РФ и п. 3.2.2.2 Договора № 161-24. Бригада из 6 человек, экскаватор и доставленные ж/б кольца находятся в состоянии вынужденного простоя.

Требуем в течение 24 часов с момента получения письма:
1. Назначить совещание с участием Автора проекта (ООО ПСК «Инжиниринг») для согласования замены К-12 на Ø2000 мм.
2. Зафиксировать дату фактической выдачи скорректированных РД и СД в протоколе.

Дальнейший простой и связанный с ним перенос срока сдачи этапа подлежит компенсации в порядке ст. 718 ГК РФ. Ответственность за нарушение графика производства работ возлагается на Заказчика.

С уважением,
Пиянзин С. С., генеральный директор ООО «СтройПроект-Регион»
М.П.`
      }
    },
    {
      id: 'case2',
      label: 'Кейс 2 · ДОП · огнезащита ригелей',
      tag: 'ДОП',
      transcript: 'Денис, тут такая история по второму этажу АБЧ. Монтажники балки уже выставили, ригели стоят, к сварке готовы. Я полез в смету — а там по огнезащите вообще ничего. Ноль. По проекту ПБшка пишет: R90 на ригели. Я нашёл альбом по «Терме» — расход три двести на квадрат, два слоя. Это материала тонн на полста, плюс работа — пескоструйка, грунт огнезащитный, нанесение. По-хорошему — это допы, надо письмо им в АэроКомпозит, чтобы согласовали, выдали либо изменения, либо ДС. Потому что иначе мы ригели зашьём гипсокартоном, инженерку уложим — а потом надзор приедет и завернёт всё к чёрту. Прикинул по-быстрому: миллиона на четыре с половиной потянет минимум. Срочно нужно решение, потому что у меня бригада уже простаивает третий день.',
      duration: '0:50',
      header: {
        number: '№ 152/26.00',
        date: '10 апреля 2026 г.',
        to: 'АО «ТехноСтрой-Альфа»',
        attn: 'Иванову А. Н., зам. ген. директора — директору филиала в г. Ульяновск',
        subject: 'ДОП · работы по огнезащите металлических ригелей перекрытия 2 этажа АБЧ объекта Е10-Е1'
      },
      letters: {
        official: `Уважаемый Александр Николаевич!

В соответствии с Договором подряда № 161-24 от 31.07.2024 г., в ходе исполнения работ по устройству перекрытия второго этажа АБЧ объекта «Е10-Е1» Подрядчиком выявлено наличие проектных требований, не подкреплённых сметной документацией.

Согласно разделу 22.023.1-ИНЖ-ПБ.2 (л. 9), для несущих металлических ригелей перекрытия установлен предел огнестойкости R90 (ст. 87 ФЗ-123). Достижение R90 для двутавров 35Б1 (приведённая толщина 4,2 мм) по альбому производителя «Терма-Стандарт» обеспечивается двухслойным нанесением состава с расходом 3,2 кг/м².

Анализ ЛСР № 02-01-02 КМ показал: учтены монтаж металлоконструкций и грунтовка ГФ-021. Позиции на огнезащитный состав, пескоструйную очистку, нанесение в два слоя и контроль DFT — отсутствуют. Расчётный объём — 1 580 м².

Руководствуясь ст. 743 п. 3, ст. 709 ГК РФ и п. 7.5 Договора, просим:
1. Согласовать выполнение работ по огнезащите ригелей как дополнительных.
2. Обеспечить выдачу проектного решения (марка состава, расход, схема нанесения, контроль DFT).
3. Обеспечить разработку и выдачу сметной документации.

Ориентировочная стоимость — 4 480 000 руб. без НДС. Срок ожидаемого ответа — 3 рабочих дня. До получения проектного решения работы по устройству подвесного потолка и инженерных сетей в зоне ригелей не возобновляются.

Приложения:
1. Расчёт объёма поверхности ригелей — 2 л.
2. Выписка из альбома «Терма-Стандарт» — 3 л.
3. Калькуляция предварительной стоимости — 1 л.

С уважением,
Лавров Д. А., зам. директора по производству ООО «СтройПроект-Регион»`,
        soft: `Уважаемый Александр Николаевич!

По разделу 22.023.1-ИНЖ-ПБ.2 (л. 9) для ригелей перекрытия требуется R90. В ЛСР-02-01-02 КМ позиции на огнезащитный состав, подготовку поверхности и нанесение отсутствуют. Расчётный объём — 1 580 м², ориентировочная стоимость — порядка 4,48 млн руб. без НДС.

Просим рассмотреть выполнение указанных работ как дополнительных в порядке ст. 743 п. 3 ГК РФ и п. 7.5 Договора. В течение 3 рабочих дней были бы признательны за выдачу проектного решения и СД. До получения документации закрытие ригелей отделкой и сетями приостановлено.

Готовы предоставить дополнительные расчёты и встретиться для обсуждения решения.

С уважением,
Лавров Д. А.`,
        hard: `Уважаемый Александр Николаевич!

Настоящим официально уведомляем: в РД 22.023.1-ИНЖ-ПБ.2 (л. 9) для несущих ригелей перекрытия 2 этажа АБЧ установлен предел огнестойкости R90 (требование ст. 87 ФЗ-123), при этом в ЛСР-02-01-02 КМ соответствующие материалы и работы полностью отсутствуют.

Выполнение последующих этапов (подвесные потолки, прокладка кабельных трасс) без огнезащиты ригелей является грубым нарушением требований пожарной безопасности и неизбежно повлечёт отказ органов госстройнадзора в выдаче ЗОС. Ранее данный риск частично затрагивался в письме Исх. № 119/26.00 от 18.03.2026 г.

Требуем в течение 24 часов:
1. Подтвердить признание работ по огнезащите ригелей дополнительными в порядке ст. 743 п. 3 ГК РФ.
2. Назначить рабочее совещание с Автором проекта для выдачи проектного решения и СД в срок не более 5 рабочих дней.

Работы в зоне ригелей перекрытия 2 этажа АБЧ остановлены с 10.04.2026 г. Простой бригады (8 чел.) и связанный с ним перенос срока сдачи этапа фиксируются и подлежат компенсации в порядке ст. 718 ГК РФ.

С уважением,
Пиянзин С. С., генеральный директор ООО «СтройПроект-Регион»
М.П.`
      }
    },
    {
      id: 'case3',
      label: 'Кейс 3 · СТОП · узел примыкания кровли',
      tag: 'СТОП',
      transcript: 'Денис, кровля встала намертво. Смотри: мы доходим сэндвичем до парапета сущки — а там в проекте узла нет. Вообще. В альбоме АС только привязка к новому парапету, к нашему. А к существующему — пустота. Звонил в инжиниринг автору, он говорит «решайте на месте». Ну, на месте я не могу — там и фартук другой, и высоты не бьются сантиметров на восемьдесят, и капельника нет. Если оставить как есть — первый же ливень утеплитель замочит, потом протечки в цеха пойдут. У них там оборудование, кстати, дорогое, лазерные станки. Я работы по этому участку остановил, монтажников снял. Надо письмо — приостановка официальная, чтобы потом, если сроки поплывут, было на что ссылаться. И срочно решение от автора, иначе кровля до зимы не закроется.',
      duration: '0:55',
      header: {
        number: '№ 156/26.00',
        date: '11 апреля 2026 г.',
        to: 'АО «ТехноСтрой-Альфа»',
        attn: 'Иванову А. Н., зам. ген. директора — директору филиала в г. Ульяновск',
        subject: 'СТОП · приостановка работ по устройству кровли в зоне примыкания к парапету существующего корпуса'
      },
      letters: {
        official: `Уважаемый Александр Николаевич!

В соответствии с Договором подряда № 160-24 от 31.07.2024 г., руководствуясь п. 3.2.2.2 Договора, ст. 716 и п. 1 ст. 719 ГК РФ, уведомляем Вас о приостановке работ по устройству кровельного покрытия в осях 14–22 / Е–К объекта «Е10-Е1» с 11 апреля 2026 г.

При выполнении работ по устройству кровли из сэндвич-панелей в зоне сопряжения нового складского корпуса с существующим производственным зданием выявлено отсутствие в РД проектного решения по узлу примыкания. Альбом узлов раздела 22.023.2-ИНЖ-АС.1 (л. 18–24) содержит исключительно узлы примыкания к новому парапету. Узел примыкания к существующему парапету в составе РД отсутствует.

Самостоятельное конструирование узла Подрядчиком невозможно:
1. Разница отметок верха парапетов составляет ~780 мм, требуется компенсирующая конструкция.
2. Существующий парапет не имеет оголовка с капельником — риск намокания утеплителя.
3. Требуется конструктивный расчёт по СП 20.13330.2016 — компетенция Автора проекта.

По прогнозу метеослужбы на ближайшие 7 суток — осадки. Продолжение работ создаёт прямую угрозу подтопления действующих производственных помещений Заказчика с лазерным раскройным оборудованием.

Руководствуясь ст. 716, п. 1 ст. 719 ГК РФ и п. 3.5 Договора, просим:
1. В кратчайший срок организовать выдачу Автором проекта (ООО ПСК «Инжиниринг») проектного решения по узлу примыкания.
2. Обеспечить корректировку сметной документации.
3. До получения проектного решения работы по устройству кровли в указанной зоне считать приостановленными.

В соответствии со ст. 718 ГК РФ простой по причине неисполнения Заказчиком встречных обязанностей влечёт перенос сроков и компенсацию убытков.

Приложения:
1. Фотофиксация зоны примыкания (5 ракурсов) — 3 л.
2. Схема разницы отметок парапетов с обмерами — 1 л.
3. Прогноз осадков по г. Ульяновск на 11.04.2026–18.04.2026 — 1 л.

С уважением,
Пиянзин С. С., генеральный директор ООО «СтройПроект-Регион»
М.П.`,
        soft: `Уважаемый Александр Николаевич!

В РД 22.023.2-ИНЖ-АС.1 (л. 18–24) отсутствует узел примыкания нового кровельного покрытия к существующему парапету. Разница отметок ~780 мм, капельника нет. Самостоятельное решение узла невозможно (требуется конструктивный расчёт по СП 20.13330.2016).

С 11.04.2026 г. работы по кровле в осях 14–22 / Е–К вынуждены приостановить (ст. 716, 719 ГК РФ; п. 3.2.2.2 Договора). Были бы признательны за содействие в выдаче проектного решения Автором проекта в кратчайший срок. Ожидаются осадки — есть риск подтопления действующего производства Заказчика.

Готовы организовать выездное совещание на объекте в удобное для Вас время.

С уважением,
Пиянзин С. С.`,
        hard: `Уважаемый Александр Николаевич!

Настоящим официально уведомляем: с 11.04.2026 г. работы по устройству кровли в зоне сопряжения нового корпуса с существующим производственным зданием (оси 14–22 / Е–К) объекта «Е10-Е1» полностью приостановлены на основании ст. 716, 719 ГК РФ и п. 3.2.2.2 Договора № 160-24.

Причина — отсутствие в составе РД 22.023.2-ИНЖ-АС.1 проектного решения по узлу примыкания к существующему парапету при разнице отметок ~780 мм и отсутствии оголовка с капельником. Прогноз осадков на ближайшие 7 суток — неблагоприятный.

Прямой риск: намокание утеплителя сэндвич-панелей и протечки в действующие производственные помещения Заказчика, в которых размещено лазерное раскройное оборудование. Возможный ущерб от выхода оборудования из строя превышает стоимость работ по узлу более чем на порядок.

Требуем в течение 24 часов:
1. Назначить выезд представителя Автора проекта (ООО ПСК «Инжиниринг») на объект для разработки проектного решения.
2. Установить срок выдачи РД и СД — не более 5 рабочих дней.
3. Подтвердить готовность Заказчика принять на себя риски ущерба от осадков на период простоя в порядке ст. 718 ГК РФ.

Все убытки, вызванные простоем бригады кровельщиков (12 чел.), а также возможным повреждением имущества Заказчика, подлежат отнесению на сторону, не исполнившую обязанность по передаче полной технической документации (ст. 743 ГК РФ).

С уважением,
Пиянзин С. С., генеральный директор ООО «СтройПроект-Регион»
М.П.`
      }
    }
  ],
  en: [
    {
      id: 'case1',
      label: 'Case 1 · CHANGE-REQUEST · Manhole MH-12',
      tag: 'CHANGE',
      transcript: 'OK, about MH-12 — we\'ve got a problem. Per the drawings, the manhole is a 1500. But three pipes come in: the main is a 1000, plus a 600 and a 400 on the sides. They physically don\'t fit a 1500. We need a 2000, minimum. My crew is standing around, the rings we got delivered are 1500 per the drawings. We need to write so they issue a revision and recalculate the BoQ. Today, otherwise tomorrow the crew is idle and so is the excavator.',
      duration: '0:45',
      header: {
        number: 'Ref. No. 148/26.00',
        date: 'April 9, 2026',
        to: 'TechnoStroy-Alpha JSC',
        attn: 'Mr. A. N. Ivanov, Deputy CEO — Director of Ulyanovsk Branch',
        subject: 'CHANGE-REQUEST · revision to detailed design 22.041.1-ENG-EWS.1, node 3 (manhole MH-12)'
      },
      letters: {
        official: `Dear Mr. Ivanov,

Pursuant to Construction Contract No. 161-24 dated July 31, 2024, in the course of preparing for stormwater network installation at the "E10-E1" facility, the Contractor has analyzed detailed design code 22.041.1-ENG-EWS.1, sheet 14, node 3 (manhole MH-12).

Per sheet 14, manhole MH-12 is specified as precast reinforced concrete with an internal diameter of 1500 mm. However, the design provides for the connection of three pipelines: a main DN1000 mm and two branch lines DN600 mm and DN400 mm. Geometric verification per SP 32.13330.2018 (clause 6.3.4) showed that accommodating three connections in a Ø1500 mm manhole violates the minimum axial distances. Minimum internal diameter must be 2000 mm.

Pursuant to clause 3.5 of the Contract and Article 743 of the Civil Code, we kindly request:
1. Issue a revised detailed design 22.041.1-ENG-EWS.1 (node 3, sheet 14) replacing MH-12 with Ø2000 mm.
2. Issue revised cost estimates reflecting the changes to FER 23-03-002-04.
3. Until the revised DD and BoQ are received, works on MH-12 are suspended.

Expected response — 3 business days. Should issuance be delayed, the Contractor will invoke Articles 716 and 719 of the Civil Code.

Enclosures:
1. Graphic diagram of the proposed MH-12 node (Ø2000) — 1 p.
2. Calculation rationale per SP 32.13330.2018 — 1 p.
3. Photographic record of delivered Ø1500 RC rings — 1 p.

Yours sincerely,
D. A. Lavrov, Deputy Director for Production, StroyProekt-Region LLC`,
        soft: `Dear Mr. Ivanov,

In preparing installation of node MH-12, a discrepancy has been identified: per the DD the manhole is Ø1500, but three pipelines (DN1000 + DN600 + DN400) are routed into it, violating clause 6.3.4 of SP 32.13330.2018. Size Ø2000 is required.

We propose jointly reviewing a replacement with Ø2000 mm. Within 3 business days we would appreciate issuance of the revised DD and BoQ. Until then, works at the node are suspended (Article 716 of the Civil Code).

Happy to discuss details at a working meeting at your convenience.

Yours sincerely,
D. A. Lavrov`,
        hard: `Dear Mr. Ivanov,

We hereby record that detailed design 22.041.1-ENG-EWS.1 (sheet 14, node 3) contains an unresolvable discrepancy — manhole MH-12 is designed at Ø1500 mm while requiring connection of three pipelines DN1000/600/400, in direct violation of clause 6.3.4 of SP 32.13330.2018, rendering the node physically unbuildable.

Effective April 9, 2026, works on MH-12 and connected stormwater segments are SUSPENDED pursuant to Articles 716, 719 of the Civil Code and clause 3.2.2.2 of Contract No. 161-24. A 6-person crew, an excavator and delivered RC rings are in forced idle status.

We DEMAND, within 24 hours:
1. Convene a meeting with the Project Author (Engineering DC LLC) to agree on replacement of MH-12 with Ø2000 mm.
2. Record the actual issuance date of the revised DD and BoQ in the minutes.

Further idle time and the resulting schedule shift shall be compensated under Article 718. Responsibility for the schedule breach rests with the Client.

Yours sincerely,
S. S. Piyanzin, CEO, StroyProekt-Region LLC
[Seal]`
      }
    },
    {
      id: 'case2',
      label: 'Case 2 · ADDITIONAL-WORKS · fire protection',
      tag: 'ADD',
      transcript: 'Denis, here\'s the situation on the second floor of the office block. The crew has the beams up, ready for welding. I went into the BoQ — nothing on fire protection. Zero. The fire safety section says R90 on the girders. I found the manufacturer\'s manual for "Therma" — 3.2 kg per square meter, two coats. About fifty tons of material plus labor. Properly speaking this is additional works. Quick estimate — at least 4.5 million. We need a decision urgently.',
      duration: '0:50',
      header: {
        number: 'Ref. No. 152/26.00',
        date: 'April 10, 2026',
        to: 'TechnoStroy-Alpha JSC',
        attn: 'Mr. A. N. Ivanov, Deputy CEO — Director of Ulyanovsk Branch',
        subject: 'ADDITIONAL-WORKS · fire protection of steel girders, 2nd floor office block, "E10-E1"'
      },
      letters: {
        official: `Dear Mr. Ivanov,

Pursuant to Construction Contract No. 161-24 dated July 31, 2024, in the course of work on the 2nd floor floor structure of the office block of the "E10-E1" facility, the Contractor has identified design requirements not supported by the cost estimates.

Per section 22.023.1-ENG-FS.2 (sheet 9), the steel girders require a fire resistance rating of R90 (Article 87 of FL No. 123-FZ). For I-beam 35B1 (reduced metal thickness 4.2 mm), per the manufacturer's manual "Therma-Standard", R90 is achieved by two-coat application at 3.2 kg/m².

Analysis of cost estimate No. 02-01-02 SC shows: steel installation and GF-021 primer are accounted for; the fire-protective coating, sandblasting, two-coat application and DFT control are NOT. Calculated area — 1,580 m².

Pursuant to Article 743 § 3, Article 709 of the Civil Code and clause 7.5, we kindly request:
1. Approve the fire protection as additional works.
2. Issue the design solution (coating brand, consumption, application scheme, DFT control).
3. Issue cost estimate documentation.

Estimated cost — RUB 4,480,000 excl. VAT. Expected response — 3 business days. Until the design solution is received, works on suspended ceilings and utilities in the girder zone shall not resume.

Enclosures:
1. Calculation of girder surface area — 2 p.
2. Extract from "Therma-Standard" manual — 3 p.
3. Preliminary cost estimate — 1 p.

Yours sincerely,
D. A. Lavrov, Deputy Director for Production, StroyProekt-Region LLC`,
        soft: `Dear Mr. Ivanov,

Per section 22.023.1-ENG-FS.2 (sheet 9) the floor girders require R90. In cost estimate 02-01-02 SC, items for the fire-protective coating, surface preparation and application are absent. Area — 1,580 m², estimated cost — approx. RUB 4.48 mn excl. VAT.

We kindly ask to consider these works as additional pursuant to Article 743 § 3 of the Civil Code and clause 7.5. Within 3 business days we would appreciate issuance of the design solution and BoQ. Closure of the girders with finishes and utilities is paused.

Happy to share further calculations and meet to discuss.

Yours sincerely,
D. A. Lavrov`,
        hard: `Dear Mr. Ivanov,

We hereby formally notify you: per DD 22.023.1-ENG-FS.2 (sheet 9) the load-bearing girders require fire resistance R90 (Article 87 of FL-123), while in cost estimate 02-01-02 SC the corresponding materials and works are entirely absent.

Performing subsequent stages (suspended ceilings, cable trays) without fire protection constitutes a gross violation of fire safety requirements and will inevitably result in refusal by state construction supervision authorities to issue a Compliance Certificate. This risk was previously raised in letter Ref. No. 119/26.00 dated March 18, 2026.

We DEMAND within 24 hours:
1. Confirm recognition of girder fire protection works as additional pursuant to Article 743 § 3.
2. Schedule a working meeting with the Project Author for issuance of the design solution and BoQ within no more than 5 business days.

Works in the 2nd floor girder zone are suspended as of April 10, 2026. Idle time of the 8-person crew and schedule shift are recorded and subject to compensation under Article 718.

Yours sincerely,
S. S. Piyanzin, CEO, StroyProekt-Region LLC
[Seal]`
      }
    },
    {
      id: 'case3',
      label: 'Case 3 · STOP · roof-to-parapet junction',
      tag: 'STOP',
      transcript: 'Denis, the roof has come to a standstill. We\'re running the sandwich panels up to the existing parapet — no node in the project. The architectural details album only covers the connection to the new parapet. I called the project author, he says "decide on site". On site I can\'t — heights don\'t match by about 80 cm, no drip edge. First storm will soak the insulation, then leaks into the production halls. They\'ve got laser cutters in there. I stopped the works, pulled the crew off. We need an official suspension letter and urgently a decision from the author.',
      duration: '0:55',
      header: {
        number: 'Ref. No. 156/26.00',
        date: 'April 11, 2026',
        to: 'TechnoStroy-Alpha JSC',
        attn: 'Mr. A. N. Ivanov, Deputy CEO — Director of Ulyanovsk Branch',
        subject: 'SUSPENSION · roofing works in the zone of junction with the existing parapet'
      },
      letters: {
        official: `Dear Mr. Ivanov,

Pursuant to Construction Contract No. 160-24 dated July 31, 2024, and guided by clause 3.2.2.2 and Articles 716 and 719 § 1 of the Civil Code, we hereby NOTIFY you of the suspension of roofing works in axes 14–22 / E–K of the "E10-E1" facility, effective April 11, 2026.

During roofing installation where the new warehouse abuts the existing production building, it has been found that the DD lacks a junction node. The details album of section 22.023.2-ENG-AS.1 (sheets 18–24) contains only nodes for connection to the new parapet. The connection node to the existing parapet is ABSENT.

Self-design of this node is impossible:
1. Parapet top elevation difference is ~780 mm, requiring a compensating structure.
2. The existing parapet has no drip edge — risk of insulation soaking.
3. Structural calculation per SP 20.13330.2016 is required — competence of the Project Author.

Per the weather forecast, precipitation is expected over the next 7 days. Continuing works without a design solution creates a direct threat of flooding to the Client's active production facilities housing laser cutting equipment.

Pursuant to Articles 716, 719 § 1 and clause 3.5, we kindly request:
1. Promptly arrange issuance, by the Project Author (Engineering DC LLC), of the design solution for the junction node.
2. Provide corresponding revision to the cost estimate documentation.
3. Until received, roofing works in the said zone are suspended.

Per Article 718, idle time caused by the Client's failure to perform counter-obligations entails postponement of dates and compensation.

Enclosures:
1. Photographic record of the junction zone (5 angles) — 3 p.
2. Diagram of the parapet elevation difference with measurements — 1 p.
3. Precipitation forecast for Ulyanovsk, April 11–18, 2026 — 1 p.

Yours sincerely,
S. S. Piyanzin, CEO, StroyProekt-Region LLC
[Seal]`,
        soft: `Dear Mr. Ivanov,

In DD 22.023.2-ENG-AS.1 (sheets 18–24) there is no junction node between the new roofing and the existing parapet. Elevation difference ~780 mm, no drip edge. Self-design is impossible (structural calculation per SP 20.13330.2016 required).

Effective April 11, 2026 we had to pause roofing works in axes 14–22 / E–K (Articles 716, 719 of the Civil Code; clause 3.2.2.2). We would be grateful for assistance in arranging the design solution from the Project Author at the earliest. Precipitation is expected — risk of flooding to active production.

Happy to arrange an on-site meeting at your convenience.

Yours sincerely,
S. S. Piyanzin`,
        hard: `Dear Mr. Ivanov,

We hereby formally notify you: effective April 11, 2026, roofing works in axes 14–22 / E–K of the "E10-E1" facility are FULLY SUSPENDED pursuant to Articles 716, 719 of the Civil Code and clause 3.2.2.2 of Contract No. 160-24.

Cause — absence in DD 22.023.2-ENG-AS.1 of the design solution for the junction node, given an elevation difference of ~780 mm and no drip edge. 7-day precipitation forecast is unfavorable.

Direct risk: insulation soaking and leaks into the Client's active production facilities housing laser cutting equipment. Potential equipment damage exceeds node works cost by an order of magnitude.

We DEMAND within 24 hours:
1. Schedule an on-site visit by a Project Author (Engineering DC LLC) representative for development of the design solution.
2. Set deadline for DD and BoQ — no more than 5 business days.
3. Confirm Client's readiness to assume risks of precipitation damage during the standstill under Article 718.

All losses caused by the standstill of the 12-person roofing crew, and any damage to the Client's property, shall be attributed to the party that failed to provide complete technical documentation (Article 743).

Yours sincerely,
S. S. Piyanzin, CEO, StroyProekt-Region LLC
[Seal]`
      }
    }
  ]
};
