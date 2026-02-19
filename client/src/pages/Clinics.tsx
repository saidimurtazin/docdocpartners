import { Card, CardContent } from "@/components/ui/card";
import { Building2, Award, Calendar, Languages } from "lucide-react";

interface Clinic {
  name: string;
  type: string;
  ownership: string;
  certifications: string;
  since: string;
  languages: string;
  image: string;
}

const clinics: Clinic[] = [
  {
    name: "Евроонко",
    type: "Узкопрофильная",
    ownership: "Частная",
    certifications: "ISO 9001, Л041-01137-77/00340670",
    since: "2011",
    languages: "Русский, Английский",
    image: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=400&h=300&fit=crop"
  },
  {
    name: "ЕМС, Европейский медицинский центр",
    type: "Многопрофильная",
    ownership: "Частная",
    certifications: "JCI, ISO 45001:2018, ISO 9001:2015",
    since: "1989",
    languages: "Русский, Английский",
    image: "https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?w=400&h=300&fit=crop"
  },
  {
    name: "МИБС (Международный институт биологических систем)",
    type: "Узкопрофильная (онкология, радиология)",
    ownership: "Частная",
    certifications: "Л041-01137-77/00340670",
    since: "2006",
    languages: "Русский, Английский",
    image: "https://images.unsplash.com/photo-1538108149393-fbbd81895907?w=400&h=300&fit=crop"
  },
  {
    name: "Сеть медицинских центров Медси",
    type: "Многопрофильная",
    ownership: "Частная",
    certifications: "Л041-01137-77/00292835, ISO 7101:2023, ISO 15189:2012",
    since: "1957",
    languages: "Русский, Английский",
    image: "https://images.unsplash.com/photo-1632833239869-a37e3a5806d2?w=400&h=300&fit=crop"
  },
  {
    name: "АО «Медицина», клиника академика Ройтберга",
    type: "Многопрофильная",
    ownership: "Частная",
    certifications: "JCI, ISO 9001, Л041-00110-77/00363409",
    since: "1990",
    languages: "Русский, Английский",
    image: "https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=400&h=300&fit=crop"
  },
  {
    name: "Сеть клиник «Мать и дитя»",
    type: "Узкопрофильная",
    ownership: "Частная",
    certifications: "Л041-01137-77/00368141",
    since: "2006",
    languages: "Русский, Английский",
    image: "https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?w=400&h=300&fit=crop"
  },
  {
    name: "Cеть частных медицинских клиник Поликлиника.ру",
    type: "Многопрофильная",
    ownership: "Частная",
    certifications: "№ЛО-77-01-018986",
    since: "1998",
    languages: "Русский, Английский",
    image: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=400&h=300&fit=crop"
  },
  {
    name: "Сеть медицинских центров «СМ-Клиника»",
    type: "Многопрофильная",
    ownership: "Частная",
    certifications: "Л041-01137-77/00368259",
    since: "2002",
    languages: "Русский, Английский",
    image: "https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?w=400&h=300&fit=crop"
  }
];

export default function Clinics() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">M</span>
            </div>
            <span className="font-bold text-xl">DocPartner</span>
          </a>
          <nav className="hidden md:flex items-center gap-6">
            <a href="/#about" className="text-sm font-medium hover:text-primary transition-colors">О программе</a>
            <a href="/clinics" className="text-sm font-medium text-primary">Клиники</a>
            <a href="/#how-it-works" className="text-sm font-medium hover:text-primary transition-colors">Как работает</a>
            <a href="/knowledge-base" className="text-sm font-medium hover:text-primary transition-colors">База знаний</a>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16 bg-gradient-to-br from-primary/5 via-background to-background">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <h1 className="text-4xl md:text-5xl font-bold">Клиники-партнеры</h1>
            <p className="text-xl text-muted-foreground">
              Проверенные медицинские учреждения, участвующие в программе DocPartner. Все клиники имеют необходимые лицензии и сертификаты качества.
            </p>
          </div>
        </div>
      </section>

      {/* Clinics Grid */}
      <section className="py-20">
        <div className="container">
          <div className="grid md:grid-cols-2 gap-8">
            {clinics.map((clinic, index) => (
              <Card key={index} className="overflow-hidden border-2 hover:border-primary/50 transition-all hover:shadow-lg">
                <div className="aspect-video overflow-hidden">
                  <img 
                    src={clinic.image} 
                    alt={clinic.name}
                    className="w-full h-full object-cover transition-transform hover:scale-105"
                  />
                </div>
                <CardContent className="p-6 space-y-4">
                  <h3 className="text-2xl font-bold">{clinic.name}</h3>
                  
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Building2 className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm">{clinic.type} • {clinic.ownership}</span>
                  </div>

                  <div className="flex items-start gap-2">
                    <Award className="w-4 h-4 flex-shrink-0 mt-1 text-primary" />
                    <div className="text-sm">
                      <div className="font-medium text-foreground mb-1">Сертификаты</div>
                      <div className="text-muted-foreground">{clinic.certifications}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm">На рынке с {clinic.since}</span>
                  </div>

                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Languages className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm">{clinic.languages}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-muted/30">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold">Готовы начать сотрудничество?</h2>
            <p className="text-xl text-muted-foreground">
              Присоединяйтесь к программе DocPartner и начните рекомендовать пациентов в проверенные клиники
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <a 
                href="https://t.me/docpartnerbot" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-md bg-primary px-8 py-3 text-lg font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Начать в Telegram
              </a>
              <a 
                href="/" 
                className="inline-flex items-center justify-center rounded-md border border-input bg-background px-8 py-3 text-lg font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                Узнать больше
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12 bg-muted/30">
        <div className="container">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground font-bold text-lg">M</span>
                </div>
                <span className="font-bold text-xl">DocPartner</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Платформа агентских рекомендаций в сфере здравоохранения
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Навигация</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="/#about" className="hover:text-primary transition-colors">О программе</a></li>
                <li><a href="/clinics" className="hover:text-primary transition-colors">Клиники</a></li>
                <li><a href="/#how-it-works" className="hover:text-primary transition-colors">Как работает</a></li>
                <li><a href="/knowledge-base" className="hover:text-primary transition-colors">База знаний</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Контакты</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>info@doc-partner.ru</li>
                <li>Москва, Россия</li>
              </ul>
            </div>
          </div>
          <div className="border-t mt-8 pt-8 text-center text-sm text-muted-foreground">
            © 2025 DocPartner. Все права защищены.
          </div>
        </div>
      </footer>
    </div>
  );
}
