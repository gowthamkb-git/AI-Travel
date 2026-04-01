class TripPlannerException(Exception):
    def __init__(self, message: str, status_code: int = 500):
        super().__init__(message)
        self.message = message
        self.status_code = status_code

    def __str__(self):
        return f"TripPlannerException [{self.status_code}]: {self.message}"
