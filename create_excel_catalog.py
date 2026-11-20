import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

data = [
    # Infecciosas
    {'nombre': 'Parvovirosis Canina (CPV-2)', 'descripcion': 'Enteritis viral aguda con diarrea severa.', 'tipo_de_enfermedad': 'Infecciosa', 'estado': 'Activo'},
    {'nombre': 'Moquillo Canino (Distémper)', 'descripcion': 'Virosis multisistémica con fiebre y tos.', 'tipo_de_enfermedad': 'Infecciosa', 'estado': 'Activo'},
    {'nombre': 'Panleucopenia Felina (FPLV)', 'descripcion': 'Infección viral aguda con leucopenia.', 'tipo_de_enfermedad': 'Infecciosa', 'estado': 'Activo'},
    {'nombre': 'Leucemia Viral Felina (FeLV)', 'descripcion': 'Retrovirus que causa inmunosupresión.', 'tipo_de_enfermedad': 'Infecciosa', 'estado': 'Activo'},
    {'nombre': 'Inmunodeficiencia Felina (FIV)', 'descripcion': 'Lentivirus que deprime el sistema inmune.', 'tipo_de_enfermedad': 'Infecciosa', 'estado': 'Activo'},
    {'nombre': 'Rabia Canina y Felina', 'descripcion': 'Encefalomielitis vírica zoonótica fatal.', 'tipo_de_enfermedad': 'Infecciosa', 'estado': 'Activo'},
    {'nombre': 'Leptospirosis Canina', 'descripcion': 'Bacteriosis con daño renal y hepático.', 'tipo_de_enfermedad': 'Infecciosa', 'estado': 'Activo'},
    {'nombre': 'Calicivirus Felino (FCV)', 'descripcion': 'Enfermedad respiratoria y úlceras orales.', 'tipo_de_enfermedad': 'Infecciosa', 'estado': 'Activo'},
    {'nombre': 'Herpesvirus Felino (FHV-1)', 'descripcion': 'Rinotraqueítis viral ocular y nasal.', 'tipo_de_enfermedad': 'Infecciosa', 'estado': 'Activo'},
    {'nombre': 'Traqueobronquitis Infecciosa (Tos perreras)', 'descripcion': 'Infección respiratoria canina contagiosa.', 'tipo_de_enfermedad': 'Infecciosa', 'estado': 'Activo'},
    {'nombre': 'Hepatitis Infecciosa Canina', 'descripcion': 'Infección viral hepática aguda por CAV-1.', 'tipo_de_enfermedad': 'Infecciosa', 'estado': 'Activo'},
    {'nombre': 'Coronavirus Entérico Canino', 'descripcion': 'Virosis intestinal leve en cachorros.', 'tipo_de_enfermedad': 'Infecciosa', 'estado': 'Activo'},
    {'nombre': 'Peritonitis Infecciosa Felina (PIF)', 'descripcion': 'Mutación por coronavirus con exudados.', 'tipo_de_enfermedad': 'Infecciosa', 'estado': 'Activo'},

    # Parasitarias
    {'nombre': 'Sarna Sarcóptica (Sarcoptes scabiei)', 'descripcion': 'Ectoparasitosis pruriginosa y costrosa.', 'tipo_de_enfermedad': 'Parasitaria', 'estado': 'Activo'},
    {'nombre': 'Sarna Demodécica (Demodex canis)', 'descripcion': 'Proliferación del ácaro Demodex canis.', 'tipo_de_enfermedad': 'Parasitaria', 'estado': 'Activo'},
    {'nombre': 'Sarna Otodéctica (Otodectes cynotis)', 'descripcion': 'Ácaros del canal auditivo en perros y gatos.', 'tipo_de_enfermedad': 'Parasitaria', 'estado': 'Activo'},
    {'nombre': 'Giardiasis Canina y Felina', 'descripcion': 'Protozoo que provoca diarrea acuosa.', 'tipo_de_enfermedad': 'Parasitaria', 'estado': 'Activo'},
    {'nombre': 'Coccidiosis Entérica', 'descripcion': 'Infección por protozoos intestinales.', 'tipo_de_enfermedad': 'Parasitaria', 'estado': 'Activo'},
    {'nombre': 'Dipilidiasis (Dipylidium caninum)', 'descripcion': 'Teniasis común transmitida por pulgas.', 'tipo_de_enfermedad': 'Parasitaria', 'estado': 'Activo'},
    {'nombre': 'Toxoplasmosis Felina', 'descripcion': 'Zoonosis por Toxoplasma gondii en gatos.', 'tipo_de_enfermedad': 'Parasitaria', 'estado': 'Activo'},
    {'nombre': 'Ancilostomiasis', 'descripcion': 'Nemátodos causantes de anemia severa.', 'tipo_de_enfermedad': 'Parasitaria', 'estado': 'Activo'},
    {'nombre': 'Dirofilariasis (Gusano del corazón)', 'descripcion': 'Gusanos parásitos en arterias pulmonares.', 'tipo_de_enfermedad': 'Parasitaria', 'estado': 'Activo'},
    {'nombre': 'Toxocariasis', 'descripcion': 'Parasitosis intestinal por ascáridos.', 'tipo_de_enfermedad': 'Parasitaria', 'estado': 'Activo'},

    # Dermatológicas
    {'nombre': 'Dermatitis Atópica Canina', 'descripcion': 'Alergia cutánea pruriginosa ambiental.', 'tipo_de_enfermedad': 'Dermatológica', 'estado': 'Activo'},
    {'nombre': 'Dermatitis Alérgica Picadura Pulga (DAPP)', 'descripcion': 'Hipersensibilidad por saliva de pulga.', 'tipo_de_enfermedad': 'Dermatológica', 'estado': 'Activo'},
    {'nombre': 'Pioderma Superficial Bacteriano', 'descripcion': 'Infección bacteriana en la piel.', 'tipo_de_enfermedad': 'Dermatológica', 'estado': 'Activo'},
    {'nombre': 'Dermatitis por Malassezia', 'descripcion': 'Sobrecrecimiento fúngico en piel y oídos.', 'tipo_de_enfermedad': 'Dermatológica', 'estado': 'Activo'},
    {'nombre': 'Dermatofitosis (Tiña)', 'descripcion': 'Infección fúngica superficial de la piel.', 'tipo_de_enfermedad': 'Dermatológica', 'estado': 'Activo'},
    {'nombre': 'Alopecia Psicógena Felina', 'descripcion': 'Pérdida de pelo por sobreacicalamiento.', 'tipo_de_enfermedad': 'Dermatológica', 'estado': 'Activo'},
    {'nombre': 'Complejo Granuloma Eosinofílico Felino', 'descripcion': 'Lesiones inflamatorias en piel felina.', 'tipo_de_enfermedad': 'Dermatológica', 'estado': 'Activo'},

    # Digestivas
    {'nombre': 'Gastroenteritis Aguda', 'descripcion': 'Inflamación de estómago e intestino.', 'tipo_de_enfermedad': 'Digestiva', 'estado': 'Activo'},
    {'nombre': 'Gastroenteritis Hemorrágica (GEH)', 'descripcion': 'Diarrea sanguinolenta y hemoconcentración.', 'tipo_de_enfermedad': 'Digestiva', 'estado': 'Activo'},
    {'nombre': 'Dilatación Vólvulo Gástrico (DVG)', 'descripcion': 'Torsión de estómago urgente en caninos.', 'tipo_de_enfermedad': 'Digestiva', 'estado': 'Activo'},
    {'nombre': 'Pancreatitis Aguda', 'descripcion': 'Inflamación aguda del tejido pancreático.', 'tipo_de_enfermedad': 'Digestiva', 'estado': 'Activo'},
    {'nombre': 'Enfermedad Inflamatoria Intestinal (IBD)', 'descripcion': 'Inflamación crónica digestiva idiopática.', 'tipo_de_enfermedad': 'Digestiva', 'estado': 'Activo'},
    {'nombre': 'Obstrucción Intestinal por Cuerpo Extraño', 'descripcion': 'Bloqueo mecánico del tracto intestinal.', 'tipo_de_enfermedad': 'Digestiva', 'estado': 'Activo'},
    {'nombre': 'Insuficiencia Pancreática Exocrina (IPE)', 'descripcion': 'Déficit en secreción de enzimas digestivas.', 'tipo_de_enfermedad': 'Digestiva', 'estado': 'Activo'},
    {'nombre': 'Lipidosis Hepática Felina', 'descripcion': 'Acumulación de grasa en el hígado felino.', 'tipo_de_enfermedad': 'Digestiva', 'estado': 'Activo'},
    {'nombre': 'Gastritis Crónica', 'descripcion': 'Irritación gástrica continua con vómitos.', 'tipo_de_enfermedad': 'Digestiva', 'estado': 'Activo'},

    # Respiratorias
    {'nombre': 'Asma Felina (Bronquitis alérgica)', 'descripcion': 'Broncoconstricción alérgica en gatos.', 'tipo_de_enfermedad': 'Respiratoria', 'estado': 'Activo'},
    {'nombre': 'Colapso Traqueal Canino', 'descripcion': 'Aplanamiento dinámico traqueal con tos.', 'tipo_de_enfermedad': 'Respiratoria', 'estado': 'Activo'},
    {'nombre': 'Síndrome Braquicefálico Obstructivo', 'descripcion': 'Obstrucción de vías aéreas en chatos.', 'tipo_de_enfermedad': 'Respiratoria', 'estado': 'Activo'},
    {'nombre': 'Bronquitis Crónica Canina', 'descripcion': 'Inflamación persistente de bronquios.', 'tipo_de_enfermedad': 'Respiratoria', 'estado': 'Activo'},
    {'nombre': 'Neumonía Bacteriana', 'descripcion': 'Infección pulmonar con tos y exudados.', 'tipo_de_enfermedad': 'Respiratoria', 'estado': 'Activo'},
    {'nombre': 'Edema Pulmonar No Cardiogénico', 'descripcion': 'Líquido acumulado en tejido pulmonar.', 'tipo_de_enfermedad': 'Respiratoria', 'estado': 'Activo'},

    # Cardíacas
    {'nombre': 'Cardiomiopatía Hipertrófica Felina (CMH)', 'descripcion': 'Engrosamiento del ventrículo izquierdo.', 'tipo_de_enfermedad': 'Cardíaca', 'estado': 'Activo'},
    {'nombre': 'Cardiomiopatía Dilatada Canina (CMD)', 'descripcion': 'Dilatación y disfunción de miocardio.', 'tipo_de_enfermedad': 'Cardíaca', 'estado': 'Activo'},
    {'nombre': 'Enfermedad Mixomatosa Valvular Mitral', 'descripcion': 'Fallo valvular progresivo en caninos.', 'tipo_de_enfermedad': 'Cardíaca', 'estado': 'Activo'},
    {'nombre': 'Insuficiencia Cardíaca Congestiva (ICC)', 'descripcion': 'Incapacidad de bombeo circulatorio.', 'tipo_de_enfermedad': 'Cardíaca', 'estado': 'Activo'},
    {'nombre': 'Estenosis Pulmonar Congénita', 'descripcion': 'Obstrucción en flujo de salida pulmonar.', 'tipo_de_enfermedad': 'Cardíaca', 'estado': 'Activo'},

    # Endocrinas
    {'nombre': 'Diabetes Mellitus Tipo 1 y 2', 'descripcion': 'Déficit de insulina con hiperglucemia.', 'tipo_de_enfermedad': 'Endocrina', 'estado': 'Activo'},
    {'nombre': 'Hipotiroidismo Canino', 'descripcion': 'Baja producción de hormonas tiroideas.', 'tipo_de_enfermedad': 'Endocrina', 'estado': 'Activo'},
    {'nombre': 'Hipertiroidismo Felino', 'descripcion': 'Exceso hormonal tiroideo en gatos sénior.', 'tipo_de_enfermedad': 'Endocrina', 'estado': 'Activo'},
    {'nombre': 'Hiperadrenocorticismo (Síndrome Cushing)', 'descripcion': 'Producción excesiva de cortisol crónico.', 'tipo_de_enfermedad': 'Endocrina', 'estado': 'Activo'},
    {'nombre': 'Hipoadrenocorticismo (Enfermedad Addison)', 'descripcion': 'Deficiencia de mineralocorticoides.', 'tipo_de_enfermedad': 'Endocrina', 'estado': 'Activo'},

    # Renales
    {'nombre': 'Insuficiencia Renal Crónica (IRC)', 'descripcion': 'Pérdida progresiva de función renal.', 'tipo_de_enfermedad': 'Renal', 'estado': 'Activo'},
    {'nombre': 'Insuficiencia Renal Aguda (IRA)', 'descripcion': 'Deterioro brusco del filtrado glomerular.', 'tipo_de_enfermedad': 'Renal', 'estado': 'Activo'},
    {'nombre': 'Enfermedad Renal Poliquística Felina (PKD)', 'descripcion': 'Quistes renales hereditarios en gatos.', 'tipo_de_enfermedad': 'Renal', 'estado': 'Activo'},
    {'nombre': 'Cistitis Idiopática Felina (CIF)', 'descripcion': 'Inflamación de vejiga asociada a estrés.', 'tipo_de_enfermedad': 'Renal', 'estado': 'Activo'},
    {'nombre': 'Urolitiasis Vesical (Cálculos)', 'descripcion': 'Cálculos de estruvita u oxalato en vías.', 'tipo_de_enfermedad': 'Renal', 'estado': 'Activo'},
    {'nombre': 'Infección del Tracto Urinario (ITU)', 'descripcion': 'Proliferación bacteriana en la vejiga.', 'tipo_de_enfermedad': 'Renal', 'estado': 'Activo'},
    {'nombre': 'Glomerulonefritis Inmune', 'descripcion': 'Inflamación de glomérulos con proteinuria.', 'tipo_de_enfermedad': 'Renal', 'estado': 'Activo'},

    # Neurológicas
    {'nombre': 'Epilepsia Idiopática', 'descripcion': 'Crisis convulsivas de origen desconocido.', 'tipo_de_enfermedad': 'Neurológica', 'estado': 'Activo'},
    {'nombre': 'Hernia Discal Intervertebral (HDIV)', 'descripcion': 'Compresión de médula por protrusión de disco.', 'tipo_de_enfermedad': 'Neurológica', 'estado': 'Activo'},
    {'nombre': 'Síndrome Vestibular Geriátrico', 'descripcion': 'Pérdida de equilibrio y nistagmo agudo.', 'tipo_de_enfermedad': 'Neurológica', 'estado': 'Activo'},
    {'nombre': 'Mielopatía Degenerativa', 'descripcion': 'Degeneración axonal de la médula espinal.', 'tipo_de_enfermedad': 'Neurológica', 'estado': 'Activo'},
    {'nombre': 'Meningoencefalitis de Origen Desconocido', 'descripcion': 'Inflamación cerebral no infecciosa.', 'tipo_de_enfermedad': 'Neurológica', 'estado': 'Activo'},

    # Oftalmológicas
    {'nombre': 'Úlcera Corneal Superficial y Profunda', 'descripcion': 'Defecto erosivo en epitelio corneal.', 'tipo_de_enfermedad': 'Oftalmológica', 'estado': 'Activo'},
    {'nombre': 'Queratoconjuntivitis Seca (Ojo seco)', 'descripcion': 'Déficit cuantitativo en película lagrimal.', 'tipo_de_enfermedad': 'Oftalmológica', 'estado': 'Activo'},
    {'nombre': 'Glaucoma Primario y Secundario', 'descripcion': 'Aumento lesivo de presión intraocular.', 'tipo_de_enfermedad': 'Oftalmológica', 'estado': 'Activo'},
    {'nombre': 'Catarata Senil o Juvenil', 'descripcion': 'Pérdida de transparencia del cristalino.', 'tipo_de_enfermedad': 'Oftalmológica', 'estado': 'Activo'},
    {'nombre': 'Uveítis Anterior', 'descripcion': 'Inflamación intraocular de iris y cuerpo.', 'tipo_de_enfermedad': 'Oftalmológica', 'estado': 'Activo'},
    {'nombre': 'Prolapso de Glándula del Tercer Párpado', 'descripcion': 'Protusión conjuntival (ojo de cereza).', 'tipo_de_enfermedad': 'Oftalmológica', 'estado': 'Activo'},

    # Ortopédicas
    {'nombre': 'Displasia de Cadera (HD)', 'descripcion': 'Incongruencia y laxitud coxofemoral.', 'tipo_de_enfermedad': 'Ortopédica', 'estado': 'Activo'},
    {'nombre': 'Ruptura de Ligamento Cruzado Craneal (LCC)', 'descripcion': 'Inestabilidad articular femorotibial.', 'tipo_de_enfermedad': 'Ortopédica', 'estado': 'Activo'},
    {'nombre': 'Luxación Patelar Medial o Lateral', 'descripcion': 'Desplazamiento rotuliano de la tróclea.', 'tipo_de_enfermedad': 'Ortopédica', 'estado': 'Activo'},
    {'nombre': 'Displasia de Codo (ED)', 'descripcion': 'Incongruencia y fragmentación en el codo.', 'tipo_de_enfermedad': 'Ortopédica', 'estado': 'Activo'},
    {'nombre': 'Osteoartritis Degenerativa (OA)', 'descripcion': 'Desgaste crónico del cartílago articular.', 'tipo_de_enfermedad': 'Ortopédica', 'estado': 'Activo'},
    {'nombre': 'Panosteítis', 'descripcion': 'Inflamación ósea autolimitada en jóvenes.', 'tipo_de_enfermedad': 'Ortopédica', 'estado': 'Activo'},

    # Oncológicas
    {'nombre': 'Linfoma Canino y Felino', 'descripcion': 'Proliferación clonal maligna linfoide.', 'tipo_de_enfermedad': 'Oncológica', 'estado': 'Activo'},
    {'nombre': 'Mastocitoma Cutáneo', 'descripcion': 'Tumor de células cebadas cutáneo frecuente.', 'tipo_de_enfermedad': 'Oncológica', 'estado': 'Activo'},
    {'nombre': 'Osteosarcoma Apendicular', 'descripcion': 'Neoplasia maligna ósea muy agresiva.', 'tipo_de_enfermedad': 'Oncológica', 'estado': 'Activo'},
    {'nombre': 'Carcinoma de Células Escamosas', 'descripcion': 'Neoplasia maligna epitelial en gatos.', 'tipo_de_enfermedad': 'Oncológica', 'estado': 'Activo'},
    {'nombre': 'Adenoma Perianal', 'descripcion': 'Tumor benigno de glándulas perianales.', 'tipo_de_enfermedad': 'Oncológica', 'estado': 'Activo'}
]

# Validation
errores = []
for idx, item in enumerate(data, start=1):
    desc = item['descripcion']
    if len(desc) > 50:
        errores.append(f"Fila {idx} ({item['nombre']}): {len(desc)} caracteres > 50 -> '{desc}'")
    if item['estado'] != 'Activo':
        errores.append(f"Fila {idx}: estado '{item['estado']}' != 'Activo'")
    if not item['tipo_de_enfermedad']:
        errores.append(f"Fila {idx}: falta tipo_de_enfermedad")
    if not item['nombre']:
        errores.append(f"Fila {idx}: falta nombre")

if errores:
    print("ERRORES DETECTADOS:")
    for err in errores:
        print(" -", err)
    raise SystemExit(1)

print(f"Validación exitosa: {len(data)} patologías. Longitud máxima de descripción: {max(len(x['descripcion']) for x in data)} caracteres.")

wb = openpyxl.Workbook()
ws = wb.active
ws.title = "Patologías"

# Exact 4 columns
headers = ['nombre', 'descripcion', 'tipo_de_enfermedad', 'estado']
ws.append(headers)

for item in data:
    ws.append([item['nombre'], item['descripcion'], item['tipo_de_enfermedad'], item['estado']])

# Styling
header_fill = PatternFill(start_color="3B41A5", end_color="3B41A5", fill_type="solid")
header_font = Font(name="Segoe UI", size=11, bold=True, color="FFFFFF")
border_thin = Side(border_style="thin", color="E2E8F0")
cell_border = Border(left=border_thin, right=border_thin, top=border_thin, bottom=border_thin)
zebra_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")

for col_num in range(1, len(headers) + 1):
    cell = ws.cell(row=1, column=col_num)
    cell.fill = header_fill
    cell.font = header_font
    cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=False)

for row_num in range(2, len(data) + 2):
    is_even = (row_num % 2 == 0)
    for col_num in range(1, len(headers) + 1):
        cell = ws.cell(row=row_num, column=col_num)
        cell.font = Font(name="Segoe UI", size=10)
        cell.border = cell_border
        if is_even:
            cell.fill = zebra_fill
        if col_num == 4:
            cell.alignment = Alignment(horizontal="center", vertical="center")
        else:
            cell.alignment = Alignment(horizontal="left", vertical="center")

# Adjust column widths
for col in ws.columns:
    max_len = 0
    col_letter = get_column_letter(col[0].column)
    for cell in col:
        val = str(cell.value or '')
        if len(val) > max_len:
            max_len = len(val)
    ws.column_dimensions[col_letter].width = max(max_len + 4, 14)

file_path = "catalogo_patologias_veterinarias.xlsx"
wb.save(file_path)
print(f"Archivo guardado exitosamente en {file_path}")

# Also copy to public/ so frontend can offer it as template download if desired
import shutil
import os
os.makedirs("public", exist_ok=True)
shutil.copyfile(file_path, os.path.join("public", file_path))
print(f"Copia guardada en public/{file_path}")
