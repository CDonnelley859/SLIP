
-- Profiles
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  handle TEXT NOT NULL UNIQUE,
  cap_color TEXT NOT NULL DEFAULT '#c9a84c',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, handle)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'handle', 'jockey_' || substr(NEW.id::text, 1, 6)));
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Cards / races / horses
CREATE TABLE public.cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_name TEXT NOT NULL,
  race_date DATE NOT NULL,
  post_time TIMESTAMPTZ NOT NULL,
  source_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'upcoming',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cards public read" ON public.cards FOR SELECT USING (true);

CREATE TABLE public.races (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  race_number INT NOT NULL,
  name TEXT,
  off_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'upcoming',
  winners JSONB,
  UNIQUE(card_id, race_number)
);
ALTER TABLE public.races ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Races public read" ON public.races FOR SELECT USING (true);

CREATE TABLE public.horses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  race_id UUID NOT NULL REFERENCES public.races(id) ON DELETE CASCADE,
  number INT NOT NULL,
  name TEXT NOT NULL,
  jockey TEXT,
  odds TEXT,
  UNIQUE(race_id, number)
);
ALTER TABLE public.horses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Horses public read" ON public.horses FOR SELECT USING (true);

-- Scrums
CREATE TABLE public.scrums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  join_code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.scrums ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.scrum_members (
  scrum_id UUID NOT NULL REFERENCES public.scrums(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (scrum_id, user_id)
);
ALTER TABLE public.scrum_members ENABLE ROW LEVEL SECURITY;

-- Helper to avoid recursive RLS
CREATE OR REPLACE FUNCTION public.is_scrum_member(_scrum_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.scrum_members WHERE scrum_id = _scrum_id AND user_id = _user_id);
$$;

CREATE POLICY "Members can view their scrums" ON public.scrums FOR SELECT
  USING (public.is_scrum_member(id, auth.uid()) OR host_id = auth.uid());
CREATE POLICY "Authenticated can create scrums" ON public.scrums FOR INSERT
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "View scrum members of own scrums" ON public.scrum_members FOR SELECT
  USING (public.is_scrum_member(scrum_id, auth.uid()));
CREATE POLICY "Join scrum as self" ON public.scrum_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Picks
CREATE TABLE public.picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scrum_id UUID NOT NULL REFERENCES public.scrums(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  race_id UUID NOT NULL REFERENCES public.races(id) ON DELETE CASCADE,
  horse_id UUID NOT NULL REFERENCES public.horses(id) ON DELETE CASCADE,
  points INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(scrum_id, user_id, race_id)
);
ALTER TABLE public.picks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view picks in scrum" ON public.picks FOR SELECT
  USING (public.is_scrum_member(scrum_id, auth.uid()));
CREATE POLICY "Insert own picks" ON public.picks FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.is_scrum_member(scrum_id, auth.uid()));
CREATE POLICY "Update own picks before off_time" ON public.picks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE TABLE public.scrum_results (
  scrum_id UUID NOT NULL REFERENCES public.scrums(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_points INT NOT NULL DEFAULT 0,
  wins INT NOT NULL DEFAULT 0,
  place INT NOT NULL DEFAULT 0,
  show INT NOT NULL DEFAULT 0,
  rank INT,
  finalized_at TIMESTAMPTZ,
  PRIMARY KEY (scrum_id, user_id)
);
ALTER TABLE public.scrum_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view results" ON public.scrum_results FOR SELECT
  USING (public.is_scrum_member(scrum_id, auth.uid()));
