export interface Region {
  id: string;
  name: string;
  full: string;
  stations: number;
}

export interface Rating {
  fair: number;
  proc: number;
  att: number;
  comm: number;
  speed: number;
}

export interface Station {
  id: string;
  region: string;
  name: string;
  depts: string[];
  rating: number;
  reviews: number;
}

export interface Officer {
  id: string;
  station: string;
  name: string;
  rank: string;
  dept: string;
  rating: Rating;
  n: number;
  history: string[];
  src: string;
}

export interface Review {
  officer: string;
  role: string;
  type: string;
  date: string;
  stars: number;
  text: string;
}

export interface Remedy {
  id: string;
  q: string;
  ch: string;
  to: string;
  base: string;
  how: string;
  tip: string;
}
