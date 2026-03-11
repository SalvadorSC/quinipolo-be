-- Add image_name column to teams table
-- Stores the logo filename from teams_logos folder (e.g. 'vallirana.png')

ALTER TABLE public.teams
ADD COLUMN IF NOT EXISTS image_name text;

COMMENT ON COLUMN public.teams.image_name IS 'Logo filename from teams_logos folder (e.g. vallirana.png)';

-- Populate image_name for waterpolo teams based on mapping
UPDATE public.teams SET image_name = 'AESE.png' WHERE sport = 'waterpolo' AND name = 'A.E. Santa Eulàlia F';

UPDATE public.teams SET image_name = 'ALCORCON.png' WHERE sport = 'waterpolo' AND name IN ('C.C Ciudad de Alcorcon F', 'C.C Ciudad de Alcorcon M');

UPDATE public.teams SET image_name = 'APOLLON.png' WHERE sport = 'waterpolo' AND name = 'Apollon Smyrnis M';

UPDATE public.teams SET image_name = 'AR CONCEPCION.png' WHERE sport = 'waterpolo' AND name IN ('A.R. Concepción Ciudad Lineal F', 'A.R. Concepción Ciudad Lineal M');

UPDATE public.teams SET image_name = 'BADIA.png' WHERE sport = 'waterpolo' AND name = 'C.N. Badia M';

UPDATE public.teams SET image_name = 'BOADILLA.jpg' WHERE sport = 'waterpolo' AND name IN ('C. Las Encinas De Boadilla M', 'C.N. Boadilla F', 'C.N. Boadilla M');

UPDATE public.teams SET image_name = 'BRESCIA.png' WHERE sport = 'waterpolo' AND name = 'A.N. Brescia';

UPDATE public.teams SET image_name = 'CABALLA.png' WHERE sport = 'waterpolo' AND name = 'C.N. Caballa M';

UPDATE public.teams SET image_name = 'CATALUNYA.png' WHERE sport = 'waterpolo' AND name IN ('C.N. Catalunya F', 'C.N. Catalunya M');

UPDATE public.teams SET image_name = 'CIUTAT DE PALMA.webp' WHERE sport = 'waterpolo' AND name IN ('C.N. Ciutat de Palma F', 'C.N. Ciutat de Palma M', 'Ciutat de Palma M');

UPDATE public.teams SET image_name = 'CNAB.png' WHERE sport = 'waterpolo' AND name IN ('C.N. Atlètic-Barceloneta F', 'C.N. Atlètic-Barceloneta M');

UPDATE public.teams SET image_name = 'CNB.png' WHERE sport = 'waterpolo' AND name IN ('C.N. Barcelona F', 'C.N. Barcelona M');

UPDATE public.teams SET image_name = 'CUATRO CAMINOS.png' WHERE sport = 'waterpolo' AND name = 'C.N. Cuatro Caminos F';

UPDATE public.teams SET image_name = 'Club-Waterpolo-Dos-Hermanas-PQS.png' WHERE sport = 'waterpolo' AND name IN ('C. Waterpolo Dos Hermanas F', 'C. Waterpolo Dos Hermanas M');

UPDATE public.teams SET image_name = 'ECHEYDE.png' WHERE sport = 'waterpolo' AND name IN ('C.N. Echeyde B M', 'C.N. Echeyde F', 'C.N. Echeyde M');

UPDATE public.teams SET image_name = 'ELCHE.jpg' WHERE sport = 'waterpolo' AND name IN ('C. Waterpolo Elx F', 'C. Waterpolo Elx M');

UPDATE public.teams SET image_name = 'ENCINAS BOADILLA.png' WHERE sport = 'waterpolo' AND name = 'C. Las Encinas De Boadilla M';

UPDATE public.teams SET image_name = 'GODELLA.jpg' WHERE sport = 'waterpolo' AND name IN ('C.N. Godella F', 'C.N. Godella M');

UPDATE public.teams SET image_name = 'GRANOLLERS.png' WHERE sport = 'waterpolo' AND name IN ('C.N. Granollers F', 'C.N. Granollers M');

UPDATE public.teams SET image_name = 'HELIOS.png' WHERE sport = 'waterpolo' AND name = 'C.N. Helios M';

UPDATE public.teams SET image_name = 'LAS PALMAS.png' WHERE sport = 'waterpolo' AND name = 'C.N. Las Palmas M';

UPDATE public.teams SET image_name = 'MALAGA.png' WHERE sport = 'waterpolo' AND name IN ('C.D. Waterpolo Malaga F', 'C.D. Waterpolo Malaga M');

UPDATE public.teams SET image_name = 'MARSEILLE.png' WHERE sport = 'waterpolo' AND name IN ('C.N. Marseille M', 'Marsella');

UPDATE public.teams SET image_name = 'mataro.svg' WHERE sport = 'waterpolo' AND name IN ('C.N. Mataró F', 'C.N. Mataró M');

UPDATE public.teams SET image_name = 'MEDI.png' WHERE sport = 'waterpolo' AND name IN ('C.E. Mediterrani F', 'C.E. Mediterrani M');

UPDATE public.teams SET image_name = 'METROPOLE.png' WHERE sport = 'waterpolo' AND name = 'C.N. Metropole M';

UPDATE public.teams SET image_name = 'MOLINS.png' WHERE sport = 'waterpolo' AND name IN ('C.N. Molins de Rei F', 'C.N. Molins de Rei M');

UPDATE public.teams SET image_name = 'MONTJUIC.png' WHERE sport = 'waterpolo' AND name IN ('C.N. Montjuïc F', 'C.N. Montjuïc M');

UPDATE public.teams SET image_name = 'NAPOLI.png' WHERE sport = 'waterpolo' AND name = 'C.C. Napoli';

UPDATE public.teams SET image_name = 'NAVARRA.png' WHERE sport = 'waterpolo' AND name IN ('C. Waterpolo Navarra M', 'Navarra B');

UPDATE public.teams SET image_name = 'PONTEVEDRA.png' WHERE sport = 'waterpolo' AND name = 'C. Waterpolo Pontevedra F';

UPDATE public.teams SET image_name = 'SEVILLA.png' WHERE sport = 'waterpolo' AND name IN ('C. Waterpolo Sevilla F', 'C. Waterpolo Sevilla M');

UPDATE public.teams SET image_name = 'TURIA.png' WHERE sport = 'waterpolo' AND name IN ('C.D. Waterpolo Turia F', 'C.D. Waterpolo Turia M');

UPDATE public.teams SET image_name = 'manresa.png' WHERE sport = 'waterpolo' AND name = 'C.N Manresa M';

UPDATE public.teams SET image_name = 'poble nou.png' WHERE sport = 'waterpolo' AND name IN ('C.N. Poble Nou F', 'C.N. Poble Nou M');

UPDATE public.teams SET image_name = 'premia.png' WHERE sport = 'waterpolo' AND name = 'C.N. Premià M';

UPDATE public.teams SET image_name = 'rubi.png' WHERE sport = 'waterpolo' AND name IN ('C.N. Rubí F', 'C.N. Rubí M');

UPDATE public.teams SET image_name = 'sabadell.png' WHERE sport = 'waterpolo' AND name IN ('C.N. Sabadell F', 'C.N. Sabadell M');

UPDATE public.teams SET image_name = 'sanfe.webp' WHERE sport = 'waterpolo' AND name IN ('C.N. Sant Feliu F', 'C.N. Sant Feliu M');

UPDATE public.teams SET image_name = 'sant andreu.png' WHERE sport = 'waterpolo' AND name IN ('C.N Sant Andreu F', 'C.N Sant Andreu M', 'C.N. Sant Andreu F', 'C.N. Sant Andreu M', 'C.N Sant Andreu M ');

UPDATE public.teams SET image_name = 'terrassa.webp' WHERE sport = 'waterpolo' AND name IN ('C.N. Terrassa F', 'C.N. Terrassa F ', 'C.N. Terrassa M', 'Terrassa ');

UPDATE public.teams SET image_name = 'uehorta.png' WHERE sport = 'waterpolo' AND name IN ('U.E Horta F', 'U.E Horta M');

UPDATE public.teams SET image_name = 'vallirana.png' WHERE sport = 'waterpolo' AND name IN ('C.N. Vallirana F', 'C.N. Vallirana M');
