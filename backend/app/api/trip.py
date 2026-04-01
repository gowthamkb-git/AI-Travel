from fastapi import APIRouter
from fastapi.responses import JSONResponse
from app.schemas.trip_schema import TripRequest, TripResponse
from app.services.trip_service import TripService
from app.exception.exceptionhandling import TripPlannerException
from app.logger.logging import logger

router = APIRouter()
trip_service = TripService()


@router.post("/plan", response_model=TripResponse)
async def plan_trip(request: TripRequest):
    try:
        logger.info(f"Received trip request: {request.question[:80]}")
        return trip_service.get_trip_plan(request.question, request.model_provider, request.history)
    except TripPlannerException as e:
        return JSONResponse(status_code=e.status_code, content={"error": e.message})
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})
