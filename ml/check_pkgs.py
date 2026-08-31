try:
    import fastapi
    import uvicorn
    import sklearn
    import pandas
    import pydantic
    print("All packages OK")
    print("sklearn:", sklearn.__version__)
    print("pandas:", pandas.__version__)
    print("fastapi:", fastapi.__version__)
except ImportError as e:
    print("Missing package:", e)
