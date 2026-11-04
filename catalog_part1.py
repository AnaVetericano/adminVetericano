# -*- coding: utf-8 -*-
"""
Catálogo completo de mapeo para los 290 items de inventario.
"""

# Mapeo item por item con farmacología veterinaria precisa
# Estructura:
# raw_index (1-based), raw_text, nombre, descripcion (50-70 chars), tipo, via, cantidad

CATALOG = [
    # 1 - 20
    (1, "ALCOHOL ANTISEPTICO GALON X 3700ML", "ALCOHOL ANTISEPTICO",
     "Solución para desinfección de la piel y asepsia de zonas clínicas.",
     "Antiséptico / Dermatológico", "Tópica (Spray / Solución)", "GALON X 3700ML"),

    (2, "TRAUMEL X TABLETA", "TRAUMEL",
     "Medicamento biorregulador para dolor e inflamación osteomuscular.",
     "Fármaco / Suplemento Oral", "Oral", "X TABLETA"),

    (3, "KERACLEEN SHAMPOO X 240 ML", "KERACLEEN SHAMPOO",
     "Champú medicinal para control de seborrea y dermatitis infecciosa.",
     "Antiséptico / Dermatológico", "Tópica (Spray / Solución)", "X 240 ML"),

    (4, "COENZYME COMPOSITUM AMPOLLA X 5 ML", "COENZYME COMPOSITUM",
     "Biorregulador homeopático para soporte de procesos enzimáticos.",
     "Fármaco Inyectable / Solución Parenteral", "Intravenosa / Intramuscular / Subcutánea", "AMPOLLA X 5 ML"),

    (5, "VETNIL ENTEREX SOBRE X 8 GRAMOS ", "VETNIL ENTEREX",
     "Adsorbente de toxinas y protector entérico en casos de diarrea.",
     "Fármaco / Suplemento Oral", "Oral", "SOBRE X 8 GRAMOS"),

    (6, "AGUA OXIGENADA OSA GALON X 3600 ML ", "AGUA OXIGENADA OSA",
     "Antiséptico oxidante y hemostático para limpieza de heridas.",
     "Antiséptico / Dermatológico", "Tópica (Spray / Solución)", "GALON X 3600 ML"),

    (7, "AGUJA DESECHABLE X UNIDAD", "AGUJA DESECHABLE",
     "Dispositivo punzocortante estéril para extracción o inyección.",
     "Insumo Médico / Quirúrgico", "N/A (Material de uso físico)", "X UNIDAD"),

    (8, "AMOXIXILIT FRASCO 100", "AMOXIXILIT",
     "Antibiótico betalactámico para infecciones respiratorias y piel.",
     "Fármaco / Suplemento Oral", "Oral", "FRASCO 100"),

    (9, "ZOLETIL 50*5 MILILITROS", "ZOLETIL 50",
     "Anestésico disociativo inyectable para sedación en cirugías.",
     "Fármaco Inyectable / Solución Parenteral", "Intravenosa / Intramuscular / Subcutánea", "5*5 MILILITROS"),

    (10, "FLAMOSIN COMPOSITUM AMPOLLA X 5 MILILITROS", "FLAMOSIN COMPOSITUM",
     "Biorregulador para procesos inflamatorios del aparato locomotor.",
     "Fármaco Inyectable / Solución Parenteral", "Intravenosa / Intramuscular / Subcutánea", "AMPOLLA X 5 MILILITROS"),

    (11, "ATROPINA SULFATO ERMA X 50 MILILITROS ", "ATROPINA SULFATO ERMA",
     "Anticolinérgico para preanestesia y manejo de bradicardia severa.",
     "Fármaco Inyectable / Solución Parenteral", "Intravenosa / Intramuscular / Subcutánea", "X 50 MILILITROS"),

    (12, "BROXICLIN INYECTABLE X 100 ML", "BROXICLIN INYECTABLE",
     "Antibiótico con mucolítico para tratar afecciones pulmonares.",
     "Fármaco Inyectable / Solución Parenteral", "Intravenosa / Intramuscular / Subcutánea", "X 100 ML"),

    (13, "UNIDOL 100 X TABLETA", "UNIDOL",
     "Antiinflamatorio no esteroideo para dolor agudo postoperatorio.",
     "Fármaco / Suplemento Oral", "Oral", "100 X TABLETA"),

    (14, "JELCO X UNIDAD ROSADO", "JELCO ROSADO",
     "Catéter intravenoso periférico para terapia de fluidos en vena.",
     "Insumo Médico / Quirúrgico", "N/A (Material de uso físico)", "X UNIDAD"),

    (15, "JELCO X UNIDAD AMARILLO", "JELCO AMARILLO",
     "Catéter venoso de pequeño calibre para pacientes neonatos y gatos.",
     "Insumo Médico / Quirúrgico", "N/A (Material de uso físico)", "X UNIDAD"),

    (16, "BAXIDIN X 120 MILILITROS ", "BAXIDIN",
     "Solución antiséptica a base de clorhexidina para lavado dérmico.",
     "Antiséptico / Dermatológico", "Tópica (Spray / Solución)", "X 120 MILILITROS"),

    (17, "BAXIDIN X 4 LITROS", "BAXIDIN",
     "Solución desinfectante de clorhexidina para instrumental y piel.",
     "Antiséptico / Dermatológico", "Tópica (Spray / Solución)", "X 4 LITROS"),

    (18, "CUTAMYCON- DF X 100 GRAMOS", "CUTAMYCON-DF",
     "Crema dermatológica polivalente antimicótica y antiinflamatoria.",
     "Antiséptico / Dermatológico", "Tópica (Spray / Solución)", "X 100 GRAMOS"),

    (19, "STOMIZOL 10 X TABLETA", "STOMIZOL",
     "Antimicrobiano de amplio espectro para infecciones periodontales.",
     "Fármaco / Suplemento Oral", "Oral", "10 X TABLETA"),

    (20, "AZIUM X 50 ML", "AZIUM",
     "Corticoide potente para choque anafiláctico e inflamación grave.",
     "Fármaco Inyectable / Solución Parenteral", "Intravenosa / Intramuscular / Subcutánea", "X 50 ML"),

    # 21 - 40
    (21, "DEXTROSA AL 10% X 500", "DEXTROSA AL 10%",
     "Solución parenteral para rehidratación y aporte de carbohidratos.",
     "Fármaco Inyectable / Solución Parenteral", "Intravenosa / Intramuscular / Subcutánea", "X 500"),

    (22, "ALERVET INYECTABLE X 50 ML", "ALERVET INYECTABLE",
     "Antihistamínico inyectable para prurito alérgico y dermatitis.",
     "Fármaco Inyectable / Solución Parenteral", "Intravenosa / Intramuscular / Subcutánea", "X 50 ML"),

    (23, "DESCENSOR VET X TABLETA", "DESCENSOR VET",
     "Hipotensor arterial para manejo de afecciones cardiovasculares.",
     "Fármaco / Suplemento Oral", "Oral", "X TABLETA"),

    (24, "ZINPAR X TABLETA", "ZINPAR",
     "Antiparasitario oral de amplio espectro para nemátodos y céstodos.",
     "Fármaco / Suplemento Oral", "Oral", "X TABLETA"),

    (25, "EDO FLOX 5% x 50 MILILITROS ", "EDO FLOX",
     "Quinolona bactericida para infecciones urinarias y digestivas.",
     "Fármaco Inyectable / Solución Parenteral", "Intravenosa / Intramuscular / Subcutánea", "5% x 50 MILILITROS"),

    (26, "BURETROLE X UNIDAD", "BURETROL",
     "Equipo de infusión graduada para dosificación precisa de suero.",
     "Insumo Médico / Quirúrgico", "N/A (Material de uso físico)", "X UNIDAD"),

    (27, "ESPARADRAPO LEUCOPLAST X TORRE", "ESPARADRAPO LEUCOPLAST",
     "Cinta adhesiva médica resistente para fijación de apósitos.",
     "Insumo Médico / Quirúrgico", "N/A (Material de uso físico)", "X TORRE"),

    (28, "EDO FLUNIX X 250 ML", "EDO FLUNIX",
     "Antiinflamatorio no esteroideo con analgesia visceral y muscular.",
     "Fármaco Inyectable / Solución Parenteral", "Intravenosa / Intramuscular / Subcutánea", "X 250 ML"),

    (29, "GASA HOSPITALARIA X ROLLO 100YDS", "GASA HOSPITALARIA",
     "Material de apósito quirúrgico para limpieza de campos y sangre.",
     "Insumo Médico / Quirúrgico", "N/A (Material de uso físico)", "X ROLLO 100YDS"),

    (30, "DERMOSYN SPRAY X 100 ML", "DERMOSYN SPRAY",
     "Loción tópica antimicrobiana y astringente para lesiones de piel.",
     "Antiséptico / Dermatológico", "Tópica (Spray / Solución)", "X 100 ML"),

    (31, "OFTALMOSYN GOTAS X 10 ML ", "OFTALMOSYN",
     "Colirio oftálmico para conjuntivitis bacteriana e inflamación.",
     "Fármaco / Suplemento Oral", "Tópica (Spray / Solución)", "GOTAS X 10 ML"),

    (32, "CALMAFOS X500 ", "CALMAFOS",
     "Complejo mineral para hipocalcemia y desbalances metabólicos.",
     "Fármaco Inyectable / Solución Parenteral", "Intravenosa / Intramuscular / Subcutánea", "X500"),

    (33, "ARTRI-VET FRASCO X 60 TABLETA", "ARTRI-VET",
     "Condroprotector para regeneración de cartílagos articulares.",
     "Fármaco / Suplemento Oral", "Oral", "FRASCO X 60 TABLETA"),

    (34, "GUANTE X CAJA TALLA M", "GUANTE LATEX TALLA M",
     "Guantes de látex desechables para examen clínico y bioseguridad.",
     "Insumo Médico / Quirúrgico", "N/A (Material de uso físico)", "X CAJA TALLA M"),

    (35, "GUAYACOLATO DE GLISERILO ERMA X 500 ML", "GUAYACOLATO DE GLICERILO ERMA",
     "Relajante muscular central para inducción e inmovilización total.",
     "Fármaco Inyectable / Solución Parenteral", "Intravenosa / Intramuscular / Subcutánea", "X 500 ML"),

    (36, "JERINGA X1 ML", "JERINGA 1 ML",
     "Dispositivo para inyección precisa y dosificación de fármacos.",
     "Insumo Médico / Quirúrgico", "N/A (Material de uso físico)", "X1 ML"),

    (37, "CARDIAL HOLLIDAY X TABLETA", "CARDIAL HOLLIDAY",
     "Vasodilatador y protector cardíaco para insuficiencia miocárdica.",
     "Fármaco / Suplemento Oral", "Oral", "X TABLETA"),

    (38, "JERINGA X10 ML", "JERINGA 10 ML",
     "Jeringa plástica desechable para suministro de medicamentos.",
     "Insumo Médico / Quirúrgico", "N/A (Material de uso físico)", "X10 ML"),

    (39, "JERINGA X 5ML", "JERINGA 5 ML",
     "Dispositivo estéril para aspiración y punción intramuscular.",
     "Insumo Médico / Quirúrgico", "N/A (Material de uso físico)", "X 5ML"),

    (40, "JERINGA X 50ML", "JERINGA 50 ML",
     "Jeringa de gran capacidad para alimentación forzada o lavados.",
     "Insumo Médico / Quirúrgico", "N/A (Material de uso físico)", "X 50ML"),

    # 41 - 60
    (41, "JERINGA X 20", "JERINGA 20 ML",
     "Jeringa estéril graduada para extracción de líquidos y fluidos.",
     "Insumo Médico / Quirúrgico", "N/A (Material de uso físico)", "X 20"),

    (42, "KENOGAN INY X 50 ML", "KENOGAN INYECTABLE",
     "Antiparasitario inyectable de efecto prolongado contra sarna.",
     "Fármaco Inyectable / Solución Parenteral", "Intravenosa / Intramuscular / Subcutánea", "X 50 ML"),

    (43, "LACEHISIS COMPOSITUM AMPOLLA X 5 ML", "LACHESIS COMPOSITUM",
     "Terapia homeopática para procesos inflamatorios graves y septicemia.",
     "Fármaco Inyectable / Solución Parenteral", "Intravenosa / Intramuscular / Subcutánea", "AMPOLLA X 5 ML"),

    (44, "LIDOCAINA INY ERMA X 50 ML", "LIDOCAINA INYECTABLE ERMA",
     "Anestésico local y antiarrítmico cardíaco de acción inmediata.",
     "Fármaco Inyectable / Solución Parenteral", "Intravenosa / Intramuscular / Subcutánea", "X 50 ML"),

    (45, "TRANQUILAN INY X 10 ML", "TRANQUILAN INYECTABLE",
     "Neuroléptico sedante y preanestésico para tranquilizar pacientes.",
     "Fármaco Inyectable / Solución Parenteral", "Intravenosa / Intramuscular / Subcutánea", "X 10 ML"),

    (46, "MANGA DE PALPAR SUPERSENSITIVA X 50", "MANGA DE PALPAR SUPERSENSITIVA",
     "Protector estéril desechable para palpación rectal y ginecología.",
     "Insumo Médico / Quirúrgico", "N/A (Material de uso físico)", "X 50"),

    (47, "OVERXICAM X 50 ML", "OVERXICAM",
     "Antiinflamatorio y antipirético para control de dolor quirúrgico.",
     "Fármaco Inyectable / Solución Parenteral", "Intravenosa / Intramuscular / Subcutánea", "X 50 ML"),

    (48, "UBREVET UNGÜENTO X 100 GRAMOS ", "UBREVET UNGÜENTO",
     "Bálsamo tópico rubefaciente para mastitis y dolores musculares.",
     "Antiséptico / Dermatológico", "Tópica (Spray / Solución)", "X 100 GRAMOS"),

    (49, "DRONTAL PUPPY X 20 ML", "DRONTAL PUPPY",
     "Antihelmíntico oral pediátrico para nematodos y giardiasis.",
     "Fármaco / Suplemento Oral", "Oral", "X 20 ML"),

    (50, "MIXILAND F,M, 4+4 FRASCO", "MIXILAND F,M",
     "Asociación antibiótica para tratar infecciones respiratorias agudas.",
     "Fármaco Inyectable / Solución Parenteral", "Intravenosa / Intramuscular / Subcutánea", "4+4 FRASCO"),

    (51, "MIXILAND F, M, 8+8 X FRASCO", "MIXILAND F,M",
     "Terapia antimicrobiana reforzada para procesos sistémicos graves.",
     "Fármaco Inyectable / Solución Parenteral", "Intravenosa / Intramuscular / Subcutánea", "8+8 X FRASCO"),

    (52, "EUTHANEX INYECTABLE X 50 ML ", "EUTHANEX INYECTABLE",
     "Agente eutanásico humanitario para producir paro cardiorrespiratorio.",
     "Fármaco Inyectable / Solución Parenteral", "Intravenosa / Intramuscular / Subcutánea", "X 50 ML"),

    (53, "PREDNISOLONA D 20 MG X TABLETA", "PREDNISOLONA D",
     "Glucocorticoide oral para patologías inflamatorias y alérgicas.",
     "Fármaco / Suplemento Oral", "Oral", "20 MG X TABLETA"),

    (54, "SOLUCION CLORURO DE SODIO 0,9%", "SOLUCION CLORURO DE SODIO 0.9%",
     "Solución isotónica estéril para rehidratación venosa y asepsia.",
     "Fármaco Inyectable / Solución Parenteral", "Intravenosa / Intramuscular / Subcutánea", "0,9%"),

    (55, "SOLUCION CLORURO DE SODIO USP 0,60", "SOLUCION CLORURO DE SODIO USP",
     "Fluido parenteral cristaloide para reposición electrolítica básica.",
     "Fármaco Inyectable / Solución Parenteral", "Intravenosa / Intramuscular / Subcutánea", "0,60"),

    (56, "VINCRISTINA 1 MGAMP", "VINCRISTINA",
     "Quimioterápico antineoplásico para linfosarcoma y tumor venéreo.",
     "Fármaco Inyectable / Solución Parenteral", "Intravenosa / Intramuscular / Subcutánea", "1 MGAMP"),

    (57, "VENOCLISIS X UNIDAD MACRO", "VENOCLISIS MACRO",
     "Equipo de infusión macrogotero para venoclisis continua de adultos.",
     "Insumo Médico / Quirúrgico", "N/A (Material de uso físico)", "X UNIDAD MACRO"),

    (58, "EQUIET XILACINA 10% X 50 ML", "EQUIET XILACINA",
     "Sedante analgésico de alta concentración para équidos y bovinos.",
     "Fármaco Inyectable / Solución Parenteral", "Intravenosa / Intramuscular / Subcutánea", "10% X 50 ML"),

    (59, "XILACINA 2% X 20 ML", "XILACINA",
     "Sedante preanestésico y relajante muscular para animales pequeños.",
     "Fármaco Inyectable / Solución Parenteral", "Intravenosa / Intramuscular / Subcutánea", "2% X 20 ML"),

    (60, "BACTRODERM YODOPOVIDONA  SOLUCION X 3,5 LT", "BACTRODERM YODOPOVIDONA",
     "Antiséptico bactericida iodado para asepsia prequirúrgica y piel.",
     "Antiséptico / Dermatológico", "Tópica (Spray / Solución)", "SOLUCION X 3,5 LT"),
]
