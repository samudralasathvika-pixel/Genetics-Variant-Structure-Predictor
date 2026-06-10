# Genetic Variants Structure Predictor using ML

> A machine learning web application that classifies genetic variants as **Pathogenic** or **Benign** based on biochemical and structural features extracted from the ClinVar database.

**Team:** Anannya Yadav (24251A05D4) · Samudrala Sathvika (24251A05J6) · Zobia Mohammedi (24251A05K6)  
**Guide:** Dr. P. Sunitha Devi, Assistant Professor, Dept. of CSE  
**Institution:** G. Narayanamma Institute of Technology & Science (For Women), Hyderabad  

---

## Table of Contents

- [Project Overview](#project-overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Input Features](#input-features)
- [Installation](#installation)
- [Running the Application](#running-the-application)
- [Using the Web Interface](#using-the-web-interface)
- [Model Details](#model-details)
- [Dataset](#dataset)
- [Performance Results](#performance-results)
- [Glossary](#glossary)

---

## Project Overview

This system automates the classification of genetic mutations using supervised machine learning. Instead of expensive and time-consuming lab experiments, the predictor takes known biochemical and structural properties of a mutation and instantly predicts whether it is likely to be disease-causing (Pathogenic) or harmless (Benign).

The model is trained on **75,305 clinically annotated records** from the NCBI ClinVar database and achieves up to **86.5% accuracy** with a **ROC-AUC of 0.936** using XGBoost.

---

## Features

- **Single Variant Prediction** — Enter six feature values manually and get an instant Pathogenic / Benign classification with a confidence score.
- **Batch Prediction via CSV Upload** — Upload a CSV file with thousands of variant records and download all predictions at once.
- **User Authentication** — Login and registration interface with credentials stored locally (no data sent to external servers).
- **Confidence Scoring** — Every prediction includes a probability score (0–1) so researchers can prioritize variants by risk level.
- **Model Comparison** — Four ML models benchmarked across three train-test split ratios (80:20, 70:30, 60:40).

---

## Tech Stack

| Layer | Technology |
|---|---|
| ML Models | XGBoost, Random Forest, Gradient Boosting, HistGradient Boosting |
| ML Libraries | Scikit-learn, XGBoost |
| Data Processing | Pandas, NumPy |
| Visualization | Matplotlib, Seaborn |
| Backend API | Python, Flask |
| Frontend | HTML, CSS, JavaScript (Fetch API) |
| Training Environment | Google Colab |

---

## Project Structure

```
genetic-variants-predictor/
│
├── app.py                  # Flask backend — API endpoints and model inference
├── model/
│   ├── xgboost_model.pkl   # Trained and serialized XGBoost model
│   └── scaler.pkl          # Feature scaler used during training
│
├── static/
│   ├── css/
│   │   └── style.css       # Stylesheet for the web interface
│   └── js/
│       └── main.js         # Frontend logic (form handling, Fetch API calls)
│
├── templates/
│   ├── index.html          # Home page
│   ├── login.html          # Login and registration page
│   ├── predictor.html      # Single variant prediction form
│   └── upload.html         # Batch CSV upload page
│
├── data/
│   └── clinvar_dataset.csv # Preprocessed ClinVar dataset (75,305 records)
│
├── notebooks/
│   └── model_training.ipynb  # Google Colab notebook for training all models
│
├── requirements.txt        # Python dependencies
└── README.md               # This file
```

---

## Input Features

The model uses **7 biochemical and structural features** derived from each genetic variant record:

| Feature | Full Name | Description |
|---|---|---|
| `wt_psic` | Wild-Type PSIC Score | Conservation score of the original (wild-type) amino acid |
| `mt_psic` | Mutant PSIC Score | Conservation score of the mutated amino acid |
| `dpsic` | Delta PSIC | Difference: `wt_psic − mt_psic`. A strongly negative value signals likely pathogenicity |
| `plddt` | Per-Residue Confidence | AlphaFold confidence score at the mutation site (0–100). >90 = structurally constrained region |
| `plddt_mean` | Mean pLDDT | Average AlphaFold confidence score in the surrounding region |
| `kdHydrophobicity_DELTAmn` | Hydrophobicity Change | Change in hydrophobicity (Kyte-Doolittle scale) between wild-type and mutant residue |
| `Volume_(A3)` | Amino Acid Volume | Van der Waals volume (Å³) of the mutant residue. Large differences cause steric clashes |

**Output:** `Pathogenic (1)` or `Benign (0)` with a confidence percentage.

---

## Installation

### Prerequisites

- Python 3.8 or higher
- pip
- Git

### Step 1 — Clone the Repository

```bash
git clone https://github.com/<your-username>/genetic-variants-predictor.git
cd genetic-variants-predictor
```

### Step 2 — Create a Virtual Environment (Recommended)

```bash
python -m venv venv

# On Windows
venv\Scripts\activate

# On macOS/Linux
source venv/bin/activate
```

### Step 3 — Install Dependencies

```bash
pip install -r requirements.txt
```

The `requirements.txt` should include:

```
flask
xgboost
scikit-learn
pandas
numpy
matplotlib
seaborn
joblib
```

If `requirements.txt` is not present, install manually:

```bash
pip install flask xgboost scikit-learn pandas numpy matplotlib seaborn joblib
```

### Step 4 — Ensure the Trained Model Exists

The `model/` folder must contain `xgboost_model.pkl` and `scaler.pkl`. If these are missing, run the training notebook first (see [Model Training](#model-training) below).

---

## Running the Application

### Start the Flask Server

```bash
python app.py
```

You should see output like:

```
 * Running on http://127.0.0.1:5000
 * Debug mode: on
```

Open your browser and navigate to:

```
http://127.0.0.1:5000
```

The application is now live locally.

---

## Using the Web Interface

### 1. Home Page
Describes the scientific background of the system — the three pillars it is based on: Structural Context (AlphaFold pLDDT), Evolutionary Conservation (PSIC scores), and Physicochemical Shifts (hydrophobicity and volume change).

### 2. Login / Register
Create a free account to access the predictor. Credentials are stored locally on your machine — no personal data is sent to any server.

### 3. Single Variant Prediction
- Navigate to the **Variant Predictor** page.
- Enter values for all six input fields: WT PSIC, MT PSIC, pLDDT, Mean pLDDT, Hydrophobicity Change, and Volume.
- Click **Predict Variant**.
- The result displays as **Pathogenic** or **Benign** along with a confidence score percentage.

### 4. Batch Prediction (CSV Upload)
- Navigate to the **Upload Dataset** page.
- Prepare a CSV file with the following column headers (order matters):

```
wt_psic, mt_psic, dpsic, plddt, plddt_mean, kdHydrophobicity_DELTAmn, Volume_(A3)
```

- Drag and drop or browse to upload the CSV file.
- The system processes all records and displays a summary table showing Pathogenic and Benign counts with confidence scores for each row.
- Results can be downloaded as a CSV file for downstream analysis.

#### Sample CSV Format

```csv
wt_psic,mt_psic,dpsic,plddt,plddt_mean,kdHydrophobicity_DELTAmn,Volume_(A3)
2.1,0.3,-1.8,92.4,88.1,-3.2,227
1.5,1.4,-0.1,65.0,70.2,0.1,115
3.0,0.1,-2.9,95.2,91.0,-4.5,189
```

---

## Model Training

If you want to retrain the models from scratch:

1. Open `notebooks/model_training.ipynb` in **Google Colab** or Jupyter Notebook.
2. Upload `data/clinvar_dataset.csv` when prompted.
3. Run all cells in order. The notebook will:
   - Preprocess and clean the ClinVar dataset
   - Engineer the `dpsic` feature
   - Train all four models (XGBoost, Random Forest, Gradient Boosting, HistGradient Boosting)
   - Evaluate each model across 80:20, 70:30, and 60:40 train-test splits
   - Save the best model (`xgboost_model.pkl`) and scaler (`scaler.pkl`) to the `model/` directory

---

## Model Details

Four ensemble ML models were trained and compared:

| Model | Accuracy | Precision | Recall | F1 Score | ROC-AUC |
|---|---|---|---|---|---|
| **XGBoost** ✅ | **0.865** | **0.851** | 0.885 | **0.868** | **0.936** |
| Random Forest | 0.860 | 0.839 | 0.891 | 0.864 | 0.931 |
| HistGradient Boosting | 0.860 | 0.845 | 0.882 | 0.863 | 0.918 |
| Gradient Boosting | 0.842 | 0.829 | 0.863 | 0.846 | 0.932 |

> ✅ **XGBoost** is the deployed model due to its highest accuracy and ROC-AUC across all three split ratios.

Results were stable across all three train-test split ratios (80:20, 70:30, 60:40), with accuracy varying by less than 0.3 percentage points, confirming the model generalizes well to unseen variants.

---

## Dataset

- **Source:** NCBI ClinVar Database (publicly available, clinically annotated)
- **Total Records:** 75,305 genetic variant records
- **Training Split:** First 80% (~60,000 records) used for training and validation
- **Test Split:** Remaining 20% (~15,000 records, 18,069 rows after preprocessing) used for final evaluation
- **Labels:** Binary — `0` = Benign, `1` = Pathogenic
- **Batch Test Result:** 9,504 Pathogenic | 8,565 Benign out of 18,069 predictions

---

## Performance Results (80:20 Split)

| Model | Accuracy | Precision | Recall | F1 Score |
|---|---|---|---|---|
| XGBoost | 0.865 | 0.851 | 0.885 | 0.868 |
| Random Forest | 0.860 | 0.839 | 0.891 | 0.864 |
| HistGradient Boosting | 0.860 | 0.845 | 0.882 | 0.863 |
| Gradient Boosting | 0.842 | 0.829 | 0.863 | 0.846 |

---

## Glossary

| Term | Meaning |
|---|---|
| **Pathogenic** | A mutation likely to cause disease by disrupting protein structure |
| **Benign** | A mutation with no significant effect on protein structure or function |
| **PSIC** | Position-Specific Independent Counts — measures evolutionary conservation of an amino acid at a given position |
| **dpsic** | Delta PSIC: difference between wild-type and mutant PSIC scores |
| **pLDDT** | Per Local Distance Difference Test — AlphaFold's per-residue confidence score (0–100) |
| **Hydrophobicity** | A measure of how strongly an amino acid repels water; drives protein folding |
| **ROC-AUC** | Area Under the Receiver Operating Characteristic Curve — overall model discrimination ability |
| **XGBoost** | Extreme Gradient Boosting — sequential tree-building algorithm with regularization |
| **ClinVar** | NCBI's public database of clinically annotated genetic variants |
| **VUS** | Variant of Uncertain Significance — a mutation whose clinical impact is not yet confirmed |

---

## Limitations

- Predictions are based on 7 features only; rare or uncommon variants may be classified with lower confidence.
- The system does not perform variant calling, whole-genome sequencing, or protein folding simulation — these steps must be completed upstream.
- Not intended for clinical diagnosis. For research and investigational use only.
- User sessions and prediction history are not persisted between sessions.

---

## Future Scope

- Incorporate deep learning models (CNN, Transformer-based) for complex genomic pattern detection.
- Add data augmentation to improve handling of rare variant types.
- Integrate with real-time clinical databases for continuous retraining.
- Expand the feature set with additional ANNOVAR-annotated or AlphaFold-derived attributes.
- Improve API accessibility for integration into clinical decision-support tools.

---

*Mini-Project 1 | Department of Computer Science & Engineering | GNITS, Hyderabad | June 2026*
