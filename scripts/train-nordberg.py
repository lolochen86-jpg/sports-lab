"""Rebuild the separate holdout evaluation and refitted 2022-26 artifact.

Download the four season CSVs from BoxScore Lab (CC BY 4.0) to --inputs-dir,
named 2022-23.csv through 2025-26.csv. Pass --output to write the artifact;
without it, results are printed only. Requires numpy, pandas and scikit-learn.
"""
from pathlib import Path
from collections import defaultdict
import argparse, hashlib, json
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, brier_score_loss, log_loss

parser=argparse.ArgumentParser()
parser.add_argument('--inputs-dir',type=Path,required=True)
parser.add_argument('--output',type=Path)
args=parser.parse_args()
files = [args.inputs_dir / f'{year}-{str(year+1)[-2:]}.csv' for year in range(2022, 2026)]
frames = [pd.read_csv(p) for p in files]
df = pd.concat(frames, ignore_index=True)
required = ['season','team','game_date','opponent','home','points','opponent_points','point_diff',
            'field_goals_made','field_goal_attempts','three_point_makes','free_throw_attempts',
            'offensive_rebounds','defensive_rebounds','assists','turnovers']
assert all(c in df.columns for c in required)
assert not df[required].isnull().any().any()
for frame in frames:
    assert len(frame) == 2460 and frame.groupby('team').size().eq(82).all()
df['home'] = df.home.astype(str).str.lower().map({'true':True, 'false':False})
assert df.home.notna().all()
df['efg'] = (df.field_goals_made + 0.5 * df.three_point_makes) / df.field_goal_attempts
df['ast_to'] = df.assists / df.turnovers.replace(0, 1)
df['ftr'] = df.free_throw_attempts / df.field_goal_attempts
cols=['point_diff','efg','ast_to','ftr','offensive_rebounds','defensive_rebounds']
assert all(np.isfinite(df[c]).all() for c in cols)

hist=defaultdict(list); X=[]; Y=[]; seasons=[]; dates=[]
for date, block in df.sort_values(['game_date','team'],kind='mergesort').groupby('game_date', sort=True):
    for _, home in block[block.home].iterrows():
        candidates = block[(~block.home) & (block.team==home.opponent) & (block.opponent==home.team) & (block.season==home.season)]
        assert len(candidates)==1
        away = candidates.iloc[0]
        assert home.points==away.opponent_points and away.points==home.opponent_points
        if len(hist[home.team]) >= 3 and len(hist[away.team]) >= 3:
            hm=np.mean(hist[home.team][-10:],axis=0); am=np.mean(hist[away.team][-10:],axis=0)
            X.append(np.column_stack((hm,am)).flatten());Y.append(int(home.points>away.points));seasons.append(home.season);dates.append(date)
    # Block updates ensure no data from this date enters predictions for another game the same date.
    assert not block.team.duplicated().any()
    for _, row in block.iterrows(): hist[row.team].append(row[cols].to_numpy(dtype=float))

X=np.asarray(X); Y=np.asarray(Y); seasons=np.asarray(seasons);dates=np.asarray(dates)
training=np.isin(seasons,['2022-23','2023-24','2024-25']); test=seasons=='2025-26'
model=LogisticRegression(random_state=42,max_iter=1000).fit(X[training],Y[training]); p=model.predict_proba(X[test])[:,1]
evaluation={'trainGames':int(sum(training)),'testGames':int(sum(test)),
 'accuracy':float(accuracy_score(Y[test],p>=.5)),'brier':float(brier_score_loss(Y[test],p)),
 'logLoss':float(log_loss(Y[test],p)),'start':str(min(dates[test])),'end':str(max(dates[test]))}
production=np.isin(seasons,['2022-23','2023-24','2024-25','2025-26'])
model=LogisticRegression(random_state=42,max_iter=1000).fit(X[production],Y[production]);
artifact={'schemaVersion':1,'method':'Nordberg last-ten logistic, independently refitted',
  'source':'https://github.com/tylernordberg0/nba-game-predictor',
  'featureSource':'https://github.com/tylernordberg0/nba-game-predictor/blob/main/src/features.py',
  'sourceLicense':'MIT','dataSource':'https://www.boxscorelab.com/downloads/',
  'dataLicense':'CC BY 4.0','trainingSeasons':['2022-23','2023-24','2024-25','2025-26'],
  'trainingGames':int(production.sum()),'trainingCutoff':str(max(dates[production])),
  'windowGames':10,'minimumGames':3,'coef':model.coef_[0].tolist(),'intercept':model.intercept_[0],
  'featureOrder':[f'{side}_{c}' for c in cols for side in ('home','away')],
  'evaluation':evaluation,'dataSha256':{f.name:hashlib.sha256(f.read_bytes()).hexdigest() for f in files},
  'limitations':['Independently refitted, not the author trained coefficients.',
    'Holdout score tests the 2022-25 fit, not the final refit; retrospective, not archived live picks.',
    'Neutral-site pairs not labelled home in the source are excluded from fit and holdout but still update team form.',
    'Team game statistics only; injuries, player rotation and trades are not direct inputs.',
    'Logistic parameters are frozen through 2025-26; do not retrain using current-season future data.']}
if args.output:
    args.output.write_text(json.dumps(artifact,indent=2),encoding='utf-8')
print(json.dumps({'evaluation':evaluation,'productionTrainingGames':artifact['trainingGames'],
                  'trainingCutoff':artifact['trainingCutoff'],'dataSha256':artifact['dataSha256']},indent=2))
