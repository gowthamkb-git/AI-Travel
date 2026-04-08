from fastapi import APIRouter, Depends
from app.db.database import get_db
from app.models.trip import TripSave, TripPublic
from app.utils.auth import get_current_user
from bson import ObjectId
from datetime import datetime
from typing import List

router = APIRouter()


@router.post("/save", response_model=TripPublic)
async def save_trip(body: TripSave, current_user=Depends(get_current_user)):
    db = get_db()
    if body.trip_id:
        existing = await db["trips"].find_one({"_id": ObjectId(body.trip_id), "user_id": str(current_user["_id"])})
        if existing:
            await db["trips"].update_one(
                {"_id": existing["_id"]},
                {"$set": {"query": body.query, "response": body.response, "created_at": datetime.utcnow()}},
            )
            existing["query"] = body.query
            existing["response"] = body.response
            existing["created_at"] = datetime.utcnow()
            doc = existing
        else:
            doc = {
                "user_id": str(current_user["_id"]),
                "query": body.query,
                "response": body.response,
                "created_at": datetime.utcnow(),
            }
            result = await db["trips"].insert_one(doc)
            doc["_id"] = result.inserted_id
    else:
        doc = {
            "user_id": str(current_user["_id"]),
            "query": body.query,
            "response": body.response,
            "created_at": datetime.utcnow(),
        }
        result = await db["trips"].insert_one(doc)
        doc["_id"] = result.inserted_id
    return TripPublic(id=str(doc["_id"]), query=doc["query"], response=doc["response"], created_at=doc["created_at"])


@router.get("/history", response_model=List[TripPublic])
async def get_history(current_user=Depends(get_current_user)):
    db = get_db()
    cursor = db["trips"].find({"user_id": str(current_user["_id"])}).sort("created_at", -1).limit(50)
    trips = []
    async for doc in cursor:
        trips.append(TripPublic(id=str(doc["_id"]), query=doc["query"], response=doc["response"], created_at=doc["created_at"]))
    return trips


@router.delete("/{trip_id}")
async def delete_trip(trip_id: str, current_user=Depends(get_current_user)):
    db = get_db()
    await db["trips"].delete_one({"_id": ObjectId(trip_id), "user_id": str(current_user["_id"])})
    return {"message": "Deleted"}
