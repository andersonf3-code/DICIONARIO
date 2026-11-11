"use client";

import { useState } from "react";
import { jsPDF } from "jspdf";
import { BookOpen, Check, CheckCircle2, ChevronLeft, ChevronRight, Download, ExternalLink, FileCheck2, FileText, Mail, Search, ShieldCheck, X } from "lucide-react";
import municipalityData from "./municipalities.json";
const municipalities: Record<string, string[]> = municipalityData;
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";

type Handler = { id: number; name: string; role: string; cpf: string; email: string };
type FormData = { institution: string; address: string; city: string; uf: string; process: string; representative: string; role: string; nationality: string; cpf: string; email: string; phone: string; purpose: string; place: string; date: string };

const steps = ["Solicitante", "Documentos"];
const localDateValue = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const initialForm: FormData = { institution: "", address: "", city: "", uf: "", process: "", representative: "", role: "", nationality: "Brasileira", cpf: "", email: "", phone: "", purpose: "", place: "", date: localDateValue() };
const destinationEmail = "caf.operacao@mda.gov.br";
const digits = (value: string) => value.replace(/\D/g, "");
const formatCpf = (value: string) => digits(value).slice(0, 11).replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
const formatSeiProcess = (value: string) => {
  const number = digits(value).slice(0, 17);
  return number
    .replace(/^(\d{5})(\d)/, "$1.$2")
    .replace(/^(\d{5}\.\d{6})(\d)/, "$1/$2")
    .replace(/^(\d{5}\.\d{6}\/\d{4})(\d)/, "$1-$2");
};
const formatDate = (value: string) => value ? new Intl.DateTimeFormat("pt-BR").format(new Date(`${value}T12:00:00`)) : "";

function validateCpf(value: string) {
  const cpf = digits(value);
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  const calc = (length: number) => { let total = 0; for (let i = 0; i < length; i++) total += Number(cpf[i]) * (length + 1 - i); const rest = (total * 10) % 11; return rest === 10 ? 0 : rest; };
  return calc(9) === Number(cpf[9]) && calc(10) === Number(cpf[10]);
}

const formatPhone = (value: string) => {
  const number = digits(value).slice(0, 11);

  if (number.length <= 2) return number;

  const ddd = number.slice(0, 2);
  const phone = number.slice(2);
  const split = phone.length > 8 ? 5 : 4;

  return `(${ddd}) ${phone.slice(0, split)}${
    phone.length > split ? "-" + phone.slice(split) : ""
  }`;
};

function pdfLines(doc: jsPDF, text: string, y: number, options?: { bold?: boolean; center?: boolean; size?: number }) {
  doc.setFont("helvetica", options?.bold ? "bold" : "normal"); doc.setFontSize(options?.size ?? 10.5);
  const lines = doc.splitTextToSize(text, 172); if (y + lines.length * 5.2 > 278) { doc.addPage(); y = 22; }
  doc.text(lines, options?.center ? 105 : 19, y, { align: options?.center ? "center" : "left" }); return y + lines.length * 5.2 + 2.5;
}

function loadPdfHeader() {
  return new Promise<string>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 792; canvas.height = 145;
      const context = canvas.getContext("2d");
      if (!context) return reject(new Error("Cabeçalho indisponível"));
      context.fillStyle = "#ffffff"; context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 4, 35, 792, 145, 0, 0, 792, 145);
      resolve(canvas.toDataURL("image/png"));
    };
    image.onerror = () => reject(new Error("Cabeçalho indisponível"));
    image.src = `${import.meta.env.BASE_URL}assets/brasao-cabecalho.png`;
  });
}
export default function Home() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(initialForm); const [notice, setNotice] = useState("");
  const [noticeError, setNoticeError] = useState(false); const [showFormErrors, setShowFormErrors] = useState(false);
  const [handlers, setHandlers] = useState<Handler[]>([{ id: 1, name: "", role: "", cpf: "", email: "" }]);
  const [nextHandlerId, setNextHandlerId] = useState(2);
  const cpfOkay = !form.cpf || validateCpf(form.cpf);
  const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  const emailOkay = !form.email || validEmail(form.email);
  const phoneOkay =
  !form.phone.trim() ||
  /^\d{10,11}$/.test(digits(form.phone));
  const formReady = Boolean(form.institution.trim() && form.address.trim() && form.city.trim() && form.uf && form.representative.trim() && form.role.trim() && form.nationality.trim() && form.cpf && cpfOkay && form.email.trim() && emailOkay && phoneOkay && form.purpose.trim() && form.date && handlers.length && handlers.every((person) => person.name.trim() && person.role.trim() && validateCpf(person.cpf) && validEmail(person.email)));
  const updateForm = (field: keyof FormData, value: string) => setForm((old) => ({ ...old, [field]: value }));
  const updateHandler = (id: number, field: keyof Omit<Handler, "id">, value: string) => setHandlers((old) => old.map((person) => person.id === id ? { ...person, [field]: value } : person));
  const addHandler = () => { setHandlers((old) => [...old, { id: nextHandlerId, name: "", role: "", cpf: "", email: "" }]); setNextHandlerId((old) => old + 1); };
  async function generatePdf(type: "responsibility" | "confidentiality", person?: Handler) {
    if (!formReady) { setShowFormErrors(true); setNoticeError(true); setNotice("Há campos obrigatórios não preenchidos ou preenchidos incorretamente. Confira as mensagens em vermelho."); setStep(0); return; }
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    try { doc.addImage(await loadPdfHeader(), "PNG", 10, 7, 190, 34.8); }
    catch { setNoticeError(true); setNotice("Não foi possível carregar o brasão para gerar o termo. Atualize a página e tente novamente."); return; }
    let y = 49;
    const title = type === "responsibility" ? "TERMO DE RESPONSABILIDADE - MDA" : "TERMO DE COMPROMISSO DE MANUTENÇÃO DE SIGILO - MDA";
    y = pdfLines(doc, title, y, { bold: true, center: true, size: 13 }); y = pdfLines(doc, `Processo nº ${form.process || "não informado"}`, y, { center: true }); y += 4;
    if (type === "responsibility") {
      y = pdfLines(doc, "Termo de Responsabilidade pela utilização de dados de identificação do Cadastro Nacional da Agricultura Familiar (CAF), regulamentado pelo Decreto nº 9.064, de 31 de maio de 2017.", y);
      y = pdfLines(doc, `O/A ${form.institution}, com sede estabelecida no/a ${form.address}, localizada(o) em ${form.city}, ${form.uf}, Brasil, doravante denominado(a) SIGNATÁRIO(A), neste ato representado(a) por ${form.representative}, ${form.role}, ${form.nationality}, CPF nº ${form.cpf}, em virtude do PROCESSO SEI nº ${form.process || "não informado"}, que trata do compartilhamento de informações do Cadastro Nacional da Agricultura Familiar - CAF, firma o presente TERMO DE RESPONSABILIDADE, que disciplina a utilização de dados de identificação do CAF mediante as cláusulas e condições descritas a seguir.`, y);
      y = pdfLines(doc, "CLÁUSULA PRIMEIRA – DO OBJETO", y, { bold: true }); y = pdfLines(doc, "O presente termo estabelece as regras que regulam a utilização dos dados de identificação do Cadastro Nacional da Agricultura Familiar (CAF), pelo(a) SIGNATÁRIO(A), sem prejuízo dos parâmetros legais vigentes.", y);
      y = pdfLines(doc, "CLÁUSULA SEGUNDA – DAS OBRIGAÇÕES DO SIGNATÁRIO", y, { bold: true }); y = pdfLines(doc, `O(A) SIGNATÁRIO(A) compromete-se a utilizar os dados de identificação do CAF exclusivamente para a finalidade de ${form.purpose}.`, y);
      y = pdfLines(doc, "O(A) SIGNATÁRIO(A) poderá permitir o acesso somente aos servidores e técnicos do órgão, mediante assinatura de Termo de Compromisso de Manutenção de Sigilo, que ficará sob guarda do signatário e será apresentado sempre que solicitado ao MDA.", y);
      ["Não disponibilizar ou ceder os dados a terceiros;", "Informar ao Ministério sobre a substituição do responsável por este Termo e pelos Termos de Compromisso de Manutenção de Sigilo;", "Utilizar medidas de segurança técnicas e administrativas aptas a proteger os dados pessoais de acessos não autorizados e de situações acidentais ou ilícitas;", "Adotar medidas para prevenir danos em virtude do tratamento dos dados;", "Eliminar os dados após a finalidade ser alcançada ou quando deixarem de ser necessários, ressalvadas as hipóteses do art. 16 da Lei nº 13.709/2018; e", "Comunicar ao Ministério a ocorrência de incidente de segurança que possa acarretar risco ou dano relevante às pessoas ou famílias inscritas no CAF."].forEach((line, i) => { y = pdfLines(doc, `${String.fromCharCode(97 + i)}) ${line}`, y); });
      y = pdfLines(doc, "CLÁUSULA TERCEIRA – DAS PENALIDADES", y, { bold: true }); y = pdfLines(doc, "O(A) SIGNATÁRIO(A), bem como os servidores e técnicos signatários do Termo de Compromisso de Manutenção de Sigilo, responderão civil e criminalmente pela utilização dos dados de identificação do CAF para fins diversos do previsto neste Termo e por quaisquer danos causados pela divulgação inadequada de informações.", y);
      y = pdfLines(doc, "CLÁUSULA QUARTA – DO PRAZO", y, { bold: true }); y = pdfLines(doc, "O tratamento deverá ocorrer por até 12 (doze) meses a contar da disponibilização. Após esse prazo, o tratamento deverá ser encerrado e os dados eliminados pelo demandante, conforme os artigos 15 e 16 da Lei nº 13.709/2018. Havendo necessidade de prorrogação, o(a) SIGNATÁRIO(A) deverá oficializar a solicitação ao Ministério em até 30 (trinta) dias antes do encerramento do prazo.", y);
    } else {
      if (!person) return;
      y = pdfLines(doc, `Eu, ${person.name}, ${person.role}, CPF nº ${person.cpf}, declaro estar ciente da habilitação que me foi conferida para tratamento de dados de identificação do Cadastro Nacional da Agricultura Familiar (CAF) no âmbito do Termo de Responsabilidade assinado pelo(a) ${form.institution}.`, y); y = pdfLines(doc, "No que se refere às atribuições a mim conferidas, comprometo-me a:", y);
      [`Manusear as bases de dados apenas por necessidade de serviço e para fins exclusivamente relacionados a ${form.purpose};`, "Proteger os dados de acessos não autorizados, garantindo que sejam manipulados em ambiente seguro e controlado;", "Manter absoluta cautela na exibição de dados em tela, impressora ou meios eletrônicos;", "Não me ausentar do terminal sem encerrar a sessão de uso das bases;", "Manter sigilo dos dados ou informações obtidos por força de minhas atribuições, abstendo-me de revelá-los a terceiros;", "Eliminar os dados após a finalidade ser alcançada ou quando deixarem de ser necessários; e", "Observar as disposições e normas da Política de Controle de Acesso aos dados do CAF."].forEach((line, i) => { y = pdfLines(doc, `${String.fromCharCode(97 + i)}) ${line}`, y); });
    }
    y += 5; y = pdfLines(doc, "E, por estar de pleno acordo, firma o presente Termo.", y); y = pdfLines(doc, `${form.place}, ${formatDate(form.date)}.`, y); y += 9;
    y = pdfLines(doc, "(assinado eletronicamente)", y, { center: true }); y = pdfLines(doc, "______________________________________________", y, { center: true }); y = pdfLines(doc, type === "responsibility" ? form.representative : person!.name, y, { center: true, bold: true }); pdfLines(doc, `CPF nº ${type === "responsibility" ? form.cpf : person!.cpf}`, y, { center: true });
    doc.save(type === "responsibility" ? "Termo_de_Responsabilidade_CAF.pdf" : `Termo_de_Compromisso_de_Sigilo_CAF_${digits(person!.cpf)}.pdf`); setNoticeError(false); setNotice("PDF gerado. Guarde o arquivo para assinatura eletrônica no gov.br.");
  }

  function openEmail() {
    if (!formReady) { setShowFormErrors(true); setNoticeError(true); setNotice("Há campos obrigatórios não preenchidos ou preenchidos incorretamente. Confira as mensagens em vermelho."); setStep(0); return; }
    const body = `Prezados,\n\nEncaminho a solicitação de dados do CAF, o termo de responsabilidade assinado, os ${handlers.length} termos de compromisso e manutenção de sigilo assinados.\n\nInstituição: ${form.institution}\nResponsável: ${form.representative}\nTratadores: ${handlers.map((person) => person.name).join(", ")}\nProcesso SEI: ${form.process || "não informado"}\n\nAtenciosamente,\n${form.representative}`;
    window.location.href = `mailto:${destinationEmail}?subject=${encodeURIComponent(`Solicitação de Compartilhamento de dados da/o ${form.institution.trim()}`)}&body=${encodeURIComponent(body)}`;
  }

  return <main className="min-h-screen bg-[var(--page)] text-[var(--ink)]">
    <header className="border-b border-white/10 bg-[#073a31] text-white"><div className="mx-auto flex max-w-[1480px] items-center justify-between gap-5 px-5 py-4 lg:px-10"><div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-[#f3c845] text-[#073a31]"><FileCheck2 size={24}/></div><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-emerald-100">Cadastro Nacional da Agricultura Familiar</p><h1 className="text-lg font-bold">Termos de Compartilhamento do CAF</h1></div></div><div className="hidden items-center gap-2 text-sm text-emerald-50 md:flex"><ShieldCheck size={18}/> Dados preenchidos permanecem no seu navegador</div></div></header>
    <div className="mx-auto max-w-[1480px] px-4 py-5 lg:px-10 lg:py-8">
      <div className="mb-6 grid gap-3 rounded-2xl border border-[#d8dfdc] bg-white p-3 shadow-sm md:grid-cols-2">{steps.map((label, index) => <button key={label} onClick={() => { if (index === 1 && !formReady) { setShowFormErrors(true); setNoticeError(true); setNotice("Confira os campos obrigatórios antes de gerar os documentos."); return; } setStep(index); }} className={`step ${index === step ? "active" : ""} ${index < step ? "done" : ""}`}><span>{index < step ? <Check size={16}/> : index + 1}</span><div><small>Etapa {index + 1}</small><strong>{label}</strong></div></button>)}</div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><p className="eyebrow">Etapa {step + 1} de 2</p><h2 className="text-2xl font-bold tracking-tight">{steps[step]}</h2></div><div className="w-full max-w-xs"><Progress value={(step + 1) * 50} className="h-2"/></div></div>
      {notice && <div role={noticeError ? "alert" : "status"} className={`mb-5 flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium ${noticeError ? "border-red-700 bg-red-600 text-white" : "border-[#b9d9cd] bg-[#edf8f4] text-[#07523f]"}`}><span className="flex items-center gap-2">{noticeError ? <ShieldCheck size={18}/> : <CheckCircle2 size={18}/>} {notice}</span><button aria-label="Fechar aviso" onClick={() => setNotice("")}><X size={18}/></button></div>}

      {step === 0 && <section className="panel p-5 md:p-8"><div className="mb-7 max-w-3xl"><h3 className="text-xl font-bold">Dados da solicitação</h3><p className="mt-2 text-sm leading-6 text-slate-500">Preencha os três grupos abaixo. Os campos com * são obrigatórios.</p></div>
        <div className="space-y-8">
          <div><h4 className="mb-4 border-b pb-2 text-lg font-bold">1. Dados da instituição solicitante</h4><div className="form-grid"><Field label="Instituição ou órgão *" value={form.institution} onChange={(v) => updateForm("institution", v)} error={showFormErrors && !form.institution.trim() ? "Campo obrigatório." : undefined} wide/><Field label="Endereço completo *" value={form.address} onChange={(v) => updateForm("address", v)} error={showFormErrors && !form.address.trim() ? "Campo obrigatório." : undefined} wide/><SelectField label="UF *" value={form.uf} onChange={(v) => setForm((old) => ({ ...old, uf: v, city: "", place: "" }))} options={Object.keys(municipalities)} error={showFormErrors && !form.uf ? "Campo obrigatório." : undefined}/><SelectField label="Município *" value={form.city} onChange={(v) => setForm((old) => ({ ...old, city: v, place: v ? `${v}/${old.uf}` : "" }))} options={form.uf ? municipalities[form.uf] || [] : []} disabled={!form.uf} placeholder={form.uf ? "Selecione o município" : "Selecione primeiro a UF"} error={showFormErrors && !form.city ? "Campo obrigatório." : undefined}/><Field label="Processo SEI" value={form.process} onChange={(v) => updateForm("process", formatSeiProcess(v))} placeholder="00000.000000/0000-00" inputMode="numeric" maxLength={20}/><Field label="Local de assinatura" value={form.place} onChange={() => {}} placeholder="Preenchido após selecionar Município e UF" readOnly/><Field label="Data do preenchimento" value={formatDate(form.date)} onChange={() => {}} readOnly/><TextField label="Finalidade do uso dos dados *" value={form.purpose} onChange={(v) => updateForm("purpose", v)} error={showFormErrors && !form.purpose.trim() ? "Campo obrigatório." : undefined} placeholder="Descreva de forma específica o estudo, política pública ou atividade..." wide/></div><p className="mt-3 text-xs leading-5 text-slate-500">O local é preenchido automaticamente com o Município/UF escolhidos, e a data corresponde ao dia do preenchimento do formulário.</p></div>
          <div><h4 className="mb-2 border-b pb-2 text-lg font-bold">2. Responsável pela instituição e pelos dados</h4><p className="mb-4 text-sm text-slate-500">Esta pessoa assinará somente o Termo de Responsabilidade.</p><div className="form-grid"><Field label="Nome do responsável *" value={form.representative} onChange={(v) => updateForm("representative", v)} error={showFormErrors && !form.representative.trim() ? "Campo obrigatório." : undefined}/><Field label="Cargo ou função *" value={form.role} onChange={(v) => updateForm("role", v)} error={showFormErrors && !form.role.trim() ? "Campo obrigatório." : undefined}/><Field label="Nacionalidade *" value={form.nationality} onChange={(v) => updateForm("nationality", v)} error={showFormErrors && !form.nationality.trim() ? "Campo obrigatório." : undefined}/><Field label="CPF do responsável *" value={form.cpf} onChange={(v) => updateForm("cpf", formatCpf(v))} error={showFormErrors && !form.cpf ? "Campo obrigatório." : !cpfOkay ? "CPF preenchido incorretamente." : undefined}/><Field label="E-mail do responsável *" value={form.email} onChange={(v) => updateForm("email", v)} error={showFormErrors && !form.email.trim() ? "Campo obrigatório." : !emailOkay ? "E-mail preenchido incorretamente." : undefined} type="email"/><Field
  label="Telefone"
  type="tel"
  inputMode="tel"
  placeholder="(61) 99999-8888"
  maxLength={15}
  value={form.phone}
  onChange={(v) => updateForm("phone", formatPhone(v))}
  error={
    !phoneOkay
      ? "Informe o telefone com DDD e 10 ou 11 dígitos."
      : undefined
  }
/></div></div>
          <div><h4 className="mb-2 border-b pb-2 text-lg font-bold">3. Pessoas que vão tratar os dados</h4><p className="mb-4 text-sm text-slate-500">Será gerado um Termo de Compromisso e Manutenção de Sigilo para cada pessoa.</p><div className="space-y-4">{handlers.map((person, index) => <div key={person.id} className="rounded-xl border border-[#d9e1de] bg-[#f8faf9] p-4"><div className="mb-4 flex items-center justify-between"><h5 className="font-bold">Tratador(a) {index + 1}</h5>{handlers.length > 1 && <Button variant="outline" size="sm" onClick={() => setHandlers((old) => old.filter((item) => item.id !== person.id))}>Remover</Button>}</div><div className="form-grid"><Field label={`Nome do tratador ${index + 1} *`} value={person.name} onChange={(v) => updateHandler(person.id, "name", v)} error={showFormErrors && !person.name.trim() ? "Campo obrigatório." : undefined}/><Field label={`Cargo ou função do tratador ${index + 1} *`} value={person.role} onChange={(v) => updateHandler(person.id, "role", v)} error={showFormErrors && !person.role.trim() ? "Campo obrigatório." : undefined}/><Field label={`CPF do tratador ${index + 1} *`} value={person.cpf} onChange={(v) => updateHandler(person.id, "cpf", formatCpf(v))} error={showFormErrors && !person.cpf ? "Campo obrigatório." : person.cpf && !validateCpf(person.cpf) ? "CPF preenchido incorretamente." : undefined}/><Field label={`E-mail do tratador ${index + 1} *`} value={person.email} onChange={(v) => updateHandler(person.id, "email", v)} error={showFormErrors && !person.email.trim() ? "Campo obrigatório." : person.email && !validEmail(person.email) ? "E-mail preenchido incorretamente." : undefined} type="email"/></div></div>)}</div><Button variant="outline" className="mt-4" onClick={addHandler}>Adicionar outra pessoa</Button></div>
        </div></section>}

      {step === 1 && <section className="grid gap-5 lg:grid-cols-[1.25fr_.75fr]"><div className="panel p-5 md:p-8"><p className="eyebrow">Documentos prontos</p><h3 className="mt-1 text-xl font-bold">Baixe, assine e encaminhe</h3><div className="mt-6 grid gap-4 md:grid-cols-2"><DocumentCard title="Termo de Responsabilidade" description={`Para ${form.representative}, responsável pela instituição.`} onDownload={() => generatePdf("responsibility")}/>{handlers.map((person) => <DocumentCard key={person.id} title="Termo de Compromisso e Manutenção de Sigilo" description={`Para ${person.name} — CPF ${person.cpf}.`} onDownload={() => generatePdf("confidentiality", person)}/>) }</div><div className="mt-6 flex flex-col gap-4 rounded-xl border border-[#c9d8d2] bg-[#f2f7f5] p-4 text-sm leading-6 text-slate-600 sm:flex-row sm:items-center sm:justify-between"><p><strong className="text-[#07523f]">Assinatura pelo gov.br:</strong> o responsável assina o Termo de Responsabilidade. Cada tratador assina seu próprio Termo de Compromisso e Manutenção de Sigilo. Anexe todos os PDFs assinados.</p><a href="https://assinador.iti.br/" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#07523f] px-4 py-2 font-semibold text-white shadow-sm transition-colors hover:bg-[#063f32] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16866b] focus-visible:ring-offset-2">Acessar assinatura GOV.BR <ExternalLink size={16}/></a></div></div><aside className="panel h-fit p-5 md:p-7"><div className="grid h-11 w-11 place-items-center rounded-xl bg-[#e5f3ee] text-[#07523f]"><Mail size={22}/></div><h3 className="mt-4 text-lg font-bold">Encaminhar por e-mail</h3><p className="mt-2 text-sm leading-6 text-slate-500">O botão abre seu aplicativo de e-mail com destinatário, assunto e mensagem preenchidos. Anexe os termos assinados.</p><div className="mt-5"><Label htmlFor="destination">E-mail da Coordenação do CAF</Label><Input id="destination" className="mt-2" type="email" value={destinationEmail} readOnly aria-readonly="true"/></div><Button className="mt-4 w-full" onClick={openEmail}><Mail size={17}/> Preparar e-mail</Button><div className="mt-6 border-t border-[#dfe5e2] pt-5 text-sm"><div className="mt-2 flex justify-between"><span className="text-slate-500">Tratadores</span><strong>{handlers.length}</strong></div></div></aside></section>}

      <footer className="mt-6 flex flex-col-reverse items-stretch justify-between gap-3 sm:flex-row sm:items-center"><Button variant="outline" disabled={step === 0} onClick={() => setStep((old) => Math.max(0, old - 1))}><ChevronLeft size={17}/> Voltar</Button>{step < 1 && <Button onClick={() => { if (!formReady) { setShowFormErrors(true); setNoticeError(true); setNotice("Há campos obrigatórios não preenchidos ou preenchidos incorretamente. Confira as mensagens em vermelho."); window.scrollTo({ top: 0, behavior: "smooth" }); return; } setShowFormErrors(false); setNoticeError(false); setNotice(""); setStep((old) => old + 1); }}>Gerar documentos<ChevronRight size={17}/></Button>}</footer>
    </div>
  </main>;
}

function Field({ label, value, onChange, wide, error, type = "text", placeholder, readOnly = false, inputMode, maxLength }: { label: string; value: string; onChange: (v: string) => void; wide?: boolean; error?: string; type?: string; placeholder?: string; readOnly?: boolean; inputMode?: "numeric" | "text" | "email" | "tel" | "decimal" | "search" | "url" | "none"; maxLength?: number }) { const id = label.replace(/\W/g, "-"); return <div className={wide ? "md:col-span-2" : ""}><Label htmlFor={id}>{label}</Label><Input id={id} aria-invalid={Boolean(error)} aria-readonly={readOnly} readOnly={readOnly} inputMode={inputMode} maxLength={maxLength} className={`mt-2 ${readOnly ? "cursor-not-allowed bg-slate-100 text-slate-700" : ""} ${error ? "border-red-600 bg-red-50" : ""}`} type={type} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)}/>{error && <p role="alert" className="mt-2 rounded-md bg-red-600 px-3 py-2 text-xs font-semibold text-white">{error}</p>}</div>; }
function SelectField({ label, value, onChange, options, error, disabled = false, placeholder = "Selecione" }: { label: string; value: string; onChange: (v: string) => void; options: string[]; error?: string; disabled?: boolean; placeholder?: string }) { return <div><Label>{label}</Label><select aria-invalid={Boolean(error)} disabled={disabled} className={`mt-2 h-9 w-full rounded-md border px-3 text-sm disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 ${error ? "border-red-600 bg-red-50" : "border-input bg-transparent"}`} value={value} onChange={(e) => onChange(e.target.value)}><option value="">{placeholder}</option>{options.map((option) => <option key={option}>{option}</option>)}</select>{error && <p role="alert" className="mt-2 rounded-md bg-red-600 px-3 py-2 text-xs font-semibold text-white">{error}</p>}</div>; }
function TextField({ label, value, onChange, placeholder, wide, error }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; wide?: boolean; error?: string }) { return <div className={wide ? "md:col-span-2" : ""}><Label>{label}</Label><Textarea aria-invalid={Boolean(error)} className={`mt-2 min-h-28 ${error ? "border-red-600 bg-red-50" : ""}`} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)}/>{error && <p role="alert" className="mt-2 rounded-md bg-red-600 px-3 py-2 text-xs font-semibold text-white">{error}</p>}</div>; }
function DocumentCard({ title, description, onDownload }: { title: string; description: string; onDownload: () => void }) { return <article className="rounded-2xl border border-[#d9e1de] bg-white p-5"><div className="flex items-start justify-between"><div className="grid h-11 w-11 place-items-center rounded-xl bg-[#f4ead0] text-[#8c6d0b]"><FileText size={22}/></div><span className="rounded-full bg-[#e7f5ef] px-2.5 py-1 text-xs font-semibold text-[#07523f]">PDF</span></div><h4 className="mt-5 font-bold">{title}</h4><p className="mt-2 min-h-12 text-sm leading-6 text-slate-500">{description}</p><Button variant="outline" className="mt-4 w-full" onClick={onDownload}><Download size={17}/> Baixar PDF</Button></article>; }
