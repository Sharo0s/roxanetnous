-- Table departements_ouverts : pilotage de la restriction geographique
-- temporaire (lancement progressif region par region).
--
-- Lecture publique (les formulaires d'inscription doivent connaitre la liste).
-- Ecriture admin uniquement (verifie via users.role = 'admin' dans les
-- Server Actions, pas via RLS car les admins n'ont pas de claim JWT dedie).

CREATE TABLE public.departements_ouverts (
  code TEXT PRIMARY KEY,
  nom TEXT NOT NULL,
  region TEXT NOT NULL,
  ouvert BOOLEAN NOT NULL DEFAULT false,
  ouvert_le TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_departements_ouverts_region ON public.departements_ouverts (region);
CREATE INDEX idx_departements_ouverts_ouvert ON public.departements_ouverts (ouvert) WHERE ouvert = true;

ALTER TABLE public.departements_ouverts ENABLE ROW LEVEL SECURITY;

-- Lecture publique (anon + authenticated)
CREATE POLICY "Lecture publique departements_ouverts"
  ON public.departements_ouverts
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Aucune policy d'ecriture : les UPDATE/INSERT/DELETE passent par
-- service_role uniquement (Server Actions admin).

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.touch_departements_ouverts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_departements_ouverts_updated_at
  BEFORE UPDATE ON public.departements_ouverts
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_departements_ouverts_updated_at();

-- Seed : 96 departements metropolitains + 2A/2B (Corse).
-- 22, 29, 35, 44, 56 ouverts au lancement (Bretagne + Loire-Atlantique).
INSERT INTO public.departements_ouverts (code, nom, region, ouvert, ouvert_le) VALUES
  ('01', 'Ain', 'Auvergne-Rhone-Alpes', false, NULL),
  ('03', 'Allier', 'Auvergne-Rhone-Alpes', false, NULL),
  ('07', 'Ardeche', 'Auvergne-Rhone-Alpes', false, NULL),
  ('15', 'Cantal', 'Auvergne-Rhone-Alpes', false, NULL),
  ('26', 'Drome', 'Auvergne-Rhone-Alpes', false, NULL),
  ('38', 'Isere', 'Auvergne-Rhone-Alpes', false, NULL),
  ('42', 'Loire', 'Auvergne-Rhone-Alpes', false, NULL),
  ('43', 'Haute-Loire', 'Auvergne-Rhone-Alpes', false, NULL),
  ('63', 'Puy-de-Dome', 'Auvergne-Rhone-Alpes', false, NULL),
  ('69', 'Rhone', 'Auvergne-Rhone-Alpes', false, NULL),
  ('73', 'Savoie', 'Auvergne-Rhone-Alpes', false, NULL),
  ('74', 'Haute-Savoie', 'Auvergne-Rhone-Alpes', false, NULL),

  ('21', 'Cote-d''Or', 'Bourgogne-Franche-Comte', false, NULL),
  ('25', 'Doubs', 'Bourgogne-Franche-Comte', false, NULL),
  ('39', 'Jura', 'Bourgogne-Franche-Comte', false, NULL),
  ('58', 'Nievre', 'Bourgogne-Franche-Comte', false, NULL),
  ('70', 'Haute-Saone', 'Bourgogne-Franche-Comte', false, NULL),
  ('71', 'Saone-et-Loire', 'Bourgogne-Franche-Comte', false, NULL),
  ('89', 'Yonne', 'Bourgogne-Franche-Comte', false, NULL),
  ('90', 'Territoire de Belfort', 'Bourgogne-Franche-Comte', false, NULL),

  ('22', 'Cotes-d''Armor', 'Bretagne', true, now()),
  ('29', 'Finistere', 'Bretagne', true, now()),
  ('35', 'Ille-et-Vilaine', 'Bretagne', true, now()),
  ('56', 'Morbihan', 'Bretagne', true, now()),

  ('18', 'Cher', 'Centre-Val de Loire', false, NULL),
  ('28', 'Eure-et-Loir', 'Centre-Val de Loire', false, NULL),
  ('36', 'Indre', 'Centre-Val de Loire', false, NULL),
  ('37', 'Indre-et-Loire', 'Centre-Val de Loire', false, NULL),
  ('41', 'Loir-et-Cher', 'Centre-Val de Loire', false, NULL),
  ('45', 'Loiret', 'Centre-Val de Loire', false, NULL),

  ('2A', 'Corse-du-Sud', 'Corse', false, NULL),
  ('2B', 'Haute-Corse', 'Corse', false, NULL),

  ('08', 'Ardennes', 'Grand Est', false, NULL),
  ('10', 'Aube', 'Grand Est', false, NULL),
  ('51', 'Marne', 'Grand Est', false, NULL),
  ('52', 'Haute-Marne', 'Grand Est', false, NULL),
  ('54', 'Meurthe-et-Moselle', 'Grand Est', false, NULL),
  ('55', 'Meuse', 'Grand Est', false, NULL),
  ('57', 'Moselle', 'Grand Est', false, NULL),
  ('67', 'Bas-Rhin', 'Grand Est', false, NULL),
  ('68', 'Haut-Rhin', 'Grand Est', false, NULL),
  ('88', 'Vosges', 'Grand Est', false, NULL),

  ('02', 'Aisne', 'Hauts-de-France', false, NULL),
  ('59', 'Nord', 'Hauts-de-France', false, NULL),
  ('60', 'Oise', 'Hauts-de-France', false, NULL),
  ('62', 'Pas-de-Calais', 'Hauts-de-France', false, NULL),
  ('80', 'Somme', 'Hauts-de-France', false, NULL),

  ('75', 'Paris', 'Ile-de-France', false, NULL),
  ('77', 'Seine-et-Marne', 'Ile-de-France', false, NULL),
  ('78', 'Yvelines', 'Ile-de-France', false, NULL),
  ('91', 'Essonne', 'Ile-de-France', false, NULL),
  ('92', 'Hauts-de-Seine', 'Ile-de-France', false, NULL),
  ('93', 'Seine-Saint-Denis', 'Ile-de-France', false, NULL),
  ('94', 'Val-de-Marne', 'Ile-de-France', false, NULL),
  ('95', 'Val-d''Oise', 'Ile-de-France', false, NULL),

  ('14', 'Calvados', 'Normandie', false, NULL),
  ('27', 'Eure', 'Normandie', false, NULL),
  ('50', 'Manche', 'Normandie', false, NULL),
  ('61', 'Orne', 'Normandie', false, NULL),
  ('76', 'Seine-Maritime', 'Normandie', false, NULL),

  ('16', 'Charente', 'Nouvelle-Aquitaine', false, NULL),
  ('17', 'Charente-Maritime', 'Nouvelle-Aquitaine', false, NULL),
  ('19', 'Correze', 'Nouvelle-Aquitaine', false, NULL),
  ('23', 'Creuse', 'Nouvelle-Aquitaine', false, NULL),
  ('24', 'Dordogne', 'Nouvelle-Aquitaine', false, NULL),
  ('33', 'Gironde', 'Nouvelle-Aquitaine', false, NULL),
  ('40', 'Landes', 'Nouvelle-Aquitaine', false, NULL),
  ('47', 'Lot-et-Garonne', 'Nouvelle-Aquitaine', false, NULL),
  ('64', 'Pyrenees-Atlantiques', 'Nouvelle-Aquitaine', false, NULL),
  ('79', 'Deux-Sevres', 'Nouvelle-Aquitaine', false, NULL),
  ('86', 'Vienne', 'Nouvelle-Aquitaine', false, NULL),
  ('87', 'Haute-Vienne', 'Nouvelle-Aquitaine', false, NULL),

  ('09', 'Ariege', 'Occitanie', false, NULL),
  ('11', 'Aude', 'Occitanie', false, NULL),
  ('12', 'Aveyron', 'Occitanie', false, NULL),
  ('30', 'Gard', 'Occitanie', false, NULL),
  ('31', 'Haute-Garonne', 'Occitanie', false, NULL),
  ('32', 'Gers', 'Occitanie', false, NULL),
  ('34', 'Herault', 'Occitanie', false, NULL),
  ('46', 'Lot', 'Occitanie', false, NULL),
  ('48', 'Lozere', 'Occitanie', false, NULL),
  ('65', 'Hautes-Pyrenees', 'Occitanie', false, NULL),
  ('66', 'Pyrenees-Orientales', 'Occitanie', false, NULL),
  ('81', 'Tarn', 'Occitanie', false, NULL),
  ('82', 'Tarn-et-Garonne', 'Occitanie', false, NULL),

  ('44', 'Loire-Atlantique', 'Pays de la Loire', true, now()),
  ('49', 'Maine-et-Loire', 'Pays de la Loire', false, NULL),
  ('53', 'Mayenne', 'Pays de la Loire', false, NULL),
  ('72', 'Sarthe', 'Pays de la Loire', false, NULL),
  ('85', 'Vendee', 'Pays de la Loire', false, NULL),

  ('04', 'Alpes-de-Haute-Provence', 'Provence-Alpes-Cote d''Azur', false, NULL),
  ('05', 'Hautes-Alpes', 'Provence-Alpes-Cote d''Azur', false, NULL),
  ('06', 'Alpes-Maritimes', 'Provence-Alpes-Cote d''Azur', false, NULL),
  ('13', 'Bouches-du-Rhone', 'Provence-Alpes-Cote d''Azur', false, NULL),
  ('83', 'Var', 'Provence-Alpes-Cote d''Azur', false, NULL),
  ('84', 'Vaucluse', 'Provence-Alpes-Cote d''Azur', false, NULL);
